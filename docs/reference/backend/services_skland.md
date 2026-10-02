# SklandService（森空岛 API 客户端）— 功能参考

> 逐行精读源码生成。行号基于当前工作区版本，仅用于快速定位。

**源文件**：`src-tauri/src/services/skland_service.rs`（1424 行）

**文件职责**：封装森空岛（zonai.skland.com）与 Hypergryph 账号体系的全部 HTTP 调用，包括设备指纹 dId 申请、HMAC+MD5 签名、cred/token 换取与刷新，以及用户资料、游戏列表、角色绑定、角色详情等业务数据的拉取与解析。

**状态注册方式**：不直接 `app.manage`。在 `src-tauri/src/lib.rs:182` 用 `Arc::new(SklandService::new(config_service.clone()))` 构造，随后注入 `NetworkService`（lib.rs:193-196）与 `AccountService`（lib.rs:199-205，后者再被 `app.manage` 为 `Arc<Mutex<AccountService>>`，lib.rs:208）；`NetworkService::new` 又把它传给 `CharDetailService`（network_service.rs:29）与 `CharWikiDetailService`（network_service.rs:33）。命令层通过 `AccountService::skland_service()`（account_service.rs:345）间接取得。

**主要依赖**：`aes` / `des` / `rsa` / `hmac`+`sha2` / `md5` / `base64` / `flate2`（gzip）/ `uuid` / `chrono` / `serde_json` / `reqwest`；crate 内的 `crate::utils::{capture, http_client, AppError}`、`crate::services::config_service::ConfigService`、`crate::models::{account, char_detail, role}` 以及 `log_debug!/info!/warn!/error!` 宏。

## 内部结构总览

| 区间 | 内容 |
| --- | --- |
| 1-26 | 密码学与工具 import、`type HmacSha256 = Hmac<Sha256>` |
| 28-29 | 常量 `ORG = "UWXspnCCJN4sfYlNfqps"`、`PUB_KEY_DER`（数美接口 RSA 公钥） |
| 32-39 | `pub struct SklandService { config_service: Arc<Mutex<ConfigService>> }` 与 `new` |
| 42-95 | dId 缓存读写：`get_or_refresh_did`、`fetch_new_did_with_retry`（后者无调用方） |
| 98-419 | `fetch_new_did`：1:1 复刻 Python 的数美设备指纹申请（RSA → DES 混淆 → gzip → AES-CBC → POST） |
| 422-449 | `calculate_sign`：森空岛签名算法 |
| 452-483 | `build_skland_request`：统一请求头注入 |
| 485-618 | `call_skland_api`：统一 API 调用入口（2 次重试 + code 校验） |
| 620-681 | `get_user_info` + `parse_user_info_response`（`/web/v1/user`） |
| 683-718 | `get_game_list` + `parse_game_list_response`（`/web/v1/game`） |
| 720-739 | `get_player_binding`（`/api/v1/game/player/binding`） |
| 741-768 | `get_role_detail`（`/api/v1/game/endfield/card/detail`） |
| 770-812 | `check_cred`（`/api/v1/user/check`，仅带 cred 头） |
| 814-934 | `refresh_cred_by_hytoken`（grant → 可选 u8 → generate_cred_by_code） |
| 936-1039 | `get_u8_token_by_channel`、`get_u8_token_by_hytoken` |
| 1041-1166 | 私有 `u8_grant_to_sk_code`、`oauth_grant_to_sk_code`（同一个 as.hypergryph grant 端点） |
| 1168-1188 | `extract_endfield_roles`（纯数据提取，无网络） |
| 1190-1215 | 自由函数 `des_encrypt_3des`（单 DES ECB + Zero Padding + Base64） |
| 1217-1424 | `mod tests`：dId 格式测试、用户资料/游戏列表解析测试（内嵌抓包样本 JSON） |

## 方法清单（必须完整）

| 方法 | 位置 | 说明（输入 → 端点 → 处理 → 输出） |
| --- | --- | --- |
| `new(config_service)` pub | 37-39 | 持有 `Arc<Mutex<ConfigService>>` → 无网络 → 构造自身 |
| `get_or_refresh_did(&self)` 私有 async | 42-73 | 读配置键 `did_cache` → 命中直接返回；未命中 → `fetch_new_did` → 写回 `did_cache` → `Ok(String)` |
| `fetch_new_did_with_retry(&self)` 私有 async | 76-95 | `fetch_new_did` 失败则 `remove("did_cache")` 后再试一次 → `Ok(String)`。**全仓无调用方（死代码）** |
| `fetch_new_did(&self)` 私有 async | 98-419 | 无入参 → `POST https://fp-it.portal101.cn/deviceprofile/v4`（payload 326-334）→ 构造指纹 JSON、DES 混淆、gzip、AES-128-CBC → 从 `detail/data/顶层` 的 `deviceId|device_id` 取值 → `Ok("B"+deviceId)` |
| `calculate_sign(&self, path, body, ts, did, token)` 私有 | 422-449 | 5 个字符串 → 无网络 → header JSON + HMAC-SHA256 + MD5 → 32 位小写 hex |
| `build_skland_request(&self, client, method, url, cred, did, sign, ts)` 私有 | 452-483 | GET/POST 分支（462-466）→ 注入 11 个请求头（468-482）→ `reqwest::RequestBuilder` |
| `call_skland_api(&self, method, path, query, body, cred, token, extra_headers)` pub async | 505-618 | 通用入口；最多 2 轮（518），第 1 轮用缓存 dId、第 2 轮清缓存重取（519-544）→ `https://zonai.skland.com{path}[?query]`（551-555）→ 签名/发包/解析，`code==0` 才返回（591-594）→ `Ok(Value)`，否则累计 `last_err` 后返回（615-617） |
| `get_user_info(&self, cred, token)` pub async | 630-645 | cred+token → `GET /web/v1/user` → `parse_user_info_response` → `SklandUserInfo` |
| `parse_user_info_response(json)` pub | 652-681 | 响应 JSON → 无网络 → `data.user` 反序列化为 `SklandUserInfo`（660-663），`userRts`→`stats`、`background` 解析失败非致命（666-671），顶层 `pendant` 覆盖 `user.pendant`（673-678）→ `SklandUserInfo` |
| `get_game_list(&self, cred, token)` pub async | 687-699 | cred+token → `GET /web/v1/game` → `parse_game_list_response` → `Vec<SklandGameInfo>` |
| `parse_game_list_response(json)` pub | 702-718 | 响应 JSON → 无网络 → 取 `data.list[]`，逐项取 `game` 并反序列化（过滤失败项）→ `Vec<SklandGameInfo>`；缺 `data.list` 报错 |
| `get_player_binding(&self, cred, token)` pub async | 721-739 | cred+token → `GET /api/v1/game/player/binding` → 整体反序列化为 `BindingResponse`（730-733）→ `response.data.list: Vec<GameBinding>` |
| `get_role_detail(&self, cred, token, role_id, server_id, user_id)` pub async | 742-768 | 3 个 id → `GET /api/v1/game/endfield/card/detail?roleId=&serverId=&userId=`（750-754）→ 反序列化 `CharDetailResponse`（758-761）→ `CharDetailResponse` |
| `check_cred(&self, cred)` pub async | 771-812 | cred → `GET https://zonai.skland.com/api/v1/user/check`（仅 cred + Content-Type，无 sign）→ `code==0` 判定（810）→ `bool` |
| `refresh_cred_by_hytoken(&self, hytoken, device_token)` pub async | 815-934 | hytoken(+device_token) → ①`oauth_grant_to_sk_code`（821）②可选 `u8_grant_to_sk_code`+`get_u8_token_by_channel`，失败仅告警不阻断（824-854）③`POST generate_cred_by_code`，payload `{kind:1, code}`（859-862），校验 `code==0`（895-903），取 `cred`/`token`/`userId`（909-931）→ `(cred, token, Option<u8_token>, user_id)` |
| `get_u8_token_by_channel(&self, sk_code)` pub async | 937-1028 | sk_code → `POST https://u8.hypergryph.com/u8/user/auth/v2/token_by_channel_token`（payload 948-954，Unity UA 965-971）→ 校验 `status==0`（997），取 `data.token`（1011-1017）与 `data.uid`（1019，用 `Value::to_string()`）→ `(token, uid)` |
| `get_u8_token_by_hytoken(&self, hytoken, device_token)` pub async | 1031-1039 | hytoken+device_token → `u8_grant_to_sk_code` → `get_u8_token_by_channel` → 丢弃 uid → `Ok(u8_token)` |
| `u8_grant_to_sk_code(&self, hytoken, device_token)` 私有 async | 1042-1105 | hytoken+device_token → `POST https://as.hypergryph.com/user/oauth2/v2/grant`，payload `{appCode:"dd7b852d5f1dd9da", deviceToken, token, type:0}`（1050-1055）→ `status==0` 校验（1088）→ `data.code` |
| `oauth_grant_to_sk_code(&self, hytoken)` 私有 async | 1108-1166 | hytoken → 同一 grant 端点，payload `{token, appCode:"4ca99fa6b56cc2ba", type:0}`（1112-1116）→ `status==0` 校验（1149）→ `data.code` |
| `extract_endfield_roles(bindings)` pub（无 `self`） | 1169-1187 | `&[GameBinding]` → 无网络 → 过滤 `app_code=="endfield"`，展平 `binding_list[].roles[]` → `Vec<(uid, server_id, role_id)>` |
| `des_encrypt_3des(key, data)` 自由函数 | 1191-1215 | 8 字节 Zero Padding（1198-1201）→ 单 DES 加密每个 8 字节块（1204-1212）→ Base64 字符串 |

合计：impl 内 20 个方法（pub 13）+ 1 个自由加密函数 = 21 个可调用项；另有 6 个测试函数（1222、1333、1363、1403、1420）与 2 个测试常量（1242、1369）。

## API 端点总表（重点）

| 方法/路径 | 用途 | 调用的方法 | 位置 |
| --- | --- | --- | --- |
| `POST https://fp-it.portal101.cn/deviceprofile/v4` | 数美设备指纹，换取 dId | `fetch_new_did` | 344（payload 326-334，日志 338） |
| `ANY https://zonai.skland.com{path}[?query]` | 所有签名业务 API 的统一出口 | `call_skland_api` | 551-555 |
| `GET /web/v1/user` | 用户资料（昵称、头像、积分、挂件、背景、社区数据） | `get_user_info` | 631 |
| `GET /web/v1/game` | 森空岛游戏列表（图标等） | `get_game_list` | 692 |
| `GET /api/v1/game/player/binding` | 账号绑定的角色列表 | `get_player_binding` | 726 |
| `GET /api/v1/game/endfield/card/detail?roleId=&serverId=&userId=` | 终末地角色详情 | `get_role_detail` | 750-754 |
| `GET https://zonai.skland.com/api/v1/user/check` | 校验 cred 是否有效 | `check_cred` | 783 |
| `POST https://zonai.skland.com/api/v1/user/auth/generate_cred_by_code` | sk_code → cred / token / userId | `refresh_cred_by_hytoken` | 870（payload 859-862） |
| `POST https://u8.hypergryph.com/u8/user/auth/v2/token_by_channel_token` | channel code → u8 渠道登录 token | `get_u8_token_by_channel` | 964（payload 948-954） |
| `POST https://as.hypergryph.com/user/oauth2/v2/grant` | hytoken → code（skland 场景 appCode=`4ca99fa6b56cc2ba`） | `oauth_grant_to_sk_code` | 1124（payload 1112-1116） |
| `POST https://as.hypergryph.com/user/oauth2/v2/grant` | hytoken+deviceToken → u8 channel code（appCode=`dd7b852d5f1dd9da`） | `u8_grant_to_sk_code` | 1063（payload 1050-1055） |

非端点 URL（仅作数据）：`https://www.skland.com/` 为指纹 target 的 `url` 字段（147）；`https://game.skland.com` 为 Origin/Referer 头（476-477）；测试样本中的 bbs.hycdn.cn 图片（1242-1416）。

## 签名与加密流程

### 1. `calculate_sign`（422-449）

```
输入: path, body_or_query, ts(秒级时间戳字符串), did, token
# L424-427 固定键序构造 header JSON（紧凑格式，无空格）
h_ca = '{"platform":"1","timestamp":"' + ts + '","dId":"' + did + '","vName":"1.45.1"}'
# L430 拼接顺序: path → body → ts → h_ca
raw  = path + body_or_query + ts + h_ca
# L437-439 HMAC-SHA256，key = token 的 UTF-8 字节，输出 hex 小写
hmac_hex = hex( HMAC_SHA256(key = token, msg = raw) )
# L444-445 对上一步的 hex "文本" 的 ASCII 字节再做 MD5
sign = md5_hex( hmac_hex.as_bytes() )      # 32 位小写 hex
返回 sign
```

`body_or_query` 取值见 `call_skland_api`：`sign_input = query.unwrap_or(&body_str)`（548）——GET 用 query string，POST 用 JSON body 字符串；无 query/body 时为空串。

### 2. 请求头注入清单（`build_skland_request`，468-482）

| Header | 值 | 行号 |
| --- | --- | --- |
| `cred` | 调用方 cred | 469 |
| `dId` | 设备指纹（`B...`） | 470 |
| `sign` | `calculate_sign` 结果 | 471 |
| `timestamp` | 秒级时间戳字符串（546 生成） | 472 |
| `platform` | 固定 `"1"` | 473 |
| `vName` | 固定 `"1.45.1"`（须与签名内一致） | 474 |
| `Content-Type` | `application/json` | 475 |
| `Origin` | `https://game.skland.com` | 476 |
| `Referer` | `https://game.skland.com/` | 477 |
| `X-Requested-With` | `com.hypergryph.skland` | 478-478 |
| `User-Agent` | Android SKLand/1.54.0 长串 | 479-482 |

`call_skland_api` 额外追加：JSON body（561-563）、`extra_headers`（564-566，如签到用的 `sk-game-role`、`token`）。

### 3. token / cred 的分工

- **cred**：身份凭证，放 `cred` 头；`check_cred` 仅凭它即可校验有效性；`refresh_cred_by_hytoken` 返回的第一个值。
- **token**：仅作签名 HMAC 的密钥（437），不直接出现在头里；`refresh_cred_by_hytoken` 返回的第二个值。签到场景会额外把它作为 `token` 头透传（attendance.rs:95、217）。
- **dId**：设备指纹，参与 header JSON 与签名；缓存在配置键 `did_cache`，失败时清缓存重取（529-536）。
- **hytoken**：Hypergryph 账号 token，只能通过 grant 换 code，再换 cred/token/u8 token，本身不用于签名。

### 4. dId（数美指纹）生成链（`fetch_new_did`，98-419）

1. `uid = uuid_v4`（100）；`pri_id = hex(MD5(uid))[..16]`（102，用作 AES key）。
2. `ep = base64(RSA-PKCS1v15-PublicEncrypt(PUB_KEY_DER, uid))`（107-124）。
3. 指纹素材：`curr_ms`、`smid = %Y%m%d%H%M%S + hex(MD5(uuid)) + "00"`、`vpw`、`trees`（131-135）。
4. `target` 含 14 个字段，严格按 `field_order`（200-215）排列：ua/platform/url/os/rtype/smid/vpw/svm/trees/pm_f/appId/organization/protocol/version（144-158）。
5. 按 `des_rules`（161-187）对每字段做**单 DES(ECB, Zero Padding, Base64)**（1191-1215），并改名为混淆键（`ua→bj`、`platform→gm`…）；`protocol`、`version` 的 key 为空则原样保留（220-249）。
6. 手工按 `field_order` 拼 JSON 字符串以固定键序（255-264）。
7. `GzBuilder::mtime(0)` + `Compression::best()` gzip → base64（275-280）。
8. AES-128-CBC：先追加 `0x00`，再补零到 16 倍数（289-294）；key=`pri_id` 字节、iv=`"0102030405060708"`，手写 CBC 循环（303-320）→ hex（322）。
9. `POST /deviceprofile/v4`，payload `{appId:"default", compress:2, data, encode:5, ep, organization:ORG, os:"web"}`（326-334）。
10. 解析：仅当**完全没有** `deviceId|device_id`（`detail`/`data`/顶层三种结构，375-388）时才检查 `code` 并报错（390-397）；取到值后返回 `format!("B{}", device_id)`（418）。

**备注**

- **缓存键**：`did_cache`（写 69、读 51、删 89 与 535），存于 `ConfigService`；全文件仅此一个缓存键。
- **错误处理**：统一 `AppError`——`ConfigError`（锁失败，48/66/86/532）与 `AuthError`（其余全部：网络、JSON 解析、密码学、业务 code）。`call_skland_api` 内部失败不立即返回，而是累计 `last_err` 并进入第 2 次尝试（516、572、595、607），两次耗尽后返回最后一条错误（615-617）。`refresh_cred_by_hytoken` 中 u8 token 分支的任何失败都只 `log_warn` 且返回 `None`（834-853），不阻断主流程。日志中 dId/cred/token 不打印明文（cred 只打 `cred=***`，778）。
- **被哪些 command 调用**（间接）：`commands/attendance.rs:88-107`（`get_attendance`）与 `:210-230`（`do_attendance`）**直接**调用 `call_skland_api`（path `/web/v1/game/endfield/attendance`）；`commands/account.rs` 的 `get_accounts`/`get_skland_account_roles`/`get_skland_user_info`/`get_skland_games`/`refresh_accounts`/`check_and_refresh_cred`/`query_role_data` 经 `AccountService` 走到 `get_role_detail`、`get_player_binding`、`get_user_info`、`get_game_list`、`check_cred`、`refresh_cred_by_hytoken`、`get_u8_token_by_hytoken`。
- **跨服务复用 `call_skland_api`**：`network_service.rs:118/126/134/142`、`char_detail_service.rs:516`、`char_wiki_detail_service.rs:196/291`、`account_service.rs:885/968`。
- **发现的异常**：① `fetch_new_did_with_retry`（76-95）全仓无调用方，属死代码；② `get_u8_token_by_channel` 的 uid 用 `Value::to_string()`（1019），JSON 字符串会带引号，且两处调用方（831、1037）均以 `_` 丢弃该返回值；③ `get_user_info` 文档注释称请求头为 `platform: 3`（626），实际实现写死 `platform: 1`（473）；④ `des_encrypt_3des` 名称/注释为 3DES，实际使用 `des::Des` 单密钥 DES（1204）；⑤ 顶部 `BlockEncryptMut, KeyIvInit`（1）及 `Compression/GzBuilder/Write`（6-7、14）在 `fetch_new_did` 内被重复 `use`（271-273、287），其中 `BlockEncryptMut`、`KeyIvInit` 无使用点；⑥ `check_cred` 不带 sign/timestamp，与其余 zonai 接口的鉴权方式不一致（783-786）；⑦ AES/DES 的 `if pad_len < N` 判断（291-294、1198-1201）在长度恰为块倍数时不补零，依赖上游 Python 同样行为。
