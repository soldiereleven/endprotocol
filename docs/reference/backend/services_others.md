# 后端服务层（其他服务）— 文件功能参考

> 逐文件精读源码生成。行号基于当前工作区版本，仅用于快速定位。
> 覆盖 `src-tauri/src/services/` 下除 `account_service.rs` / `skland_service.rs` / `game_launcher_service.rs` 外的全部文件。

## `src-tauri/src/services/mod.rs`
**职责**：服务层的模块声明清单，仅 10 行，把 10 个服务模块公开为 `pub mod`。

**导出**：`account_service`、`avatar_cache_service`、`char_detail_service`、`char_wiki_detail_service`、`config_service`、`data_query`、`game_launcher_service`、`gacha_service`、`network_service`、`skland_service`（全部为模块，无类型/方法）。

**状态**：不注册任何 Tauri State，仅提供命名空间。

| 符号 | 位置 | 说明 |
| --- | --- | --- |
| `pub mod account_service` | mod.rs:1 | 账户服务（其他文档负责） |
| `pub mod avatar_cache_service` | mod.rs:2 | 图片/头像本地缓存服务 |
| `pub mod char_detail_service` | mod.rs:3 | 角色详情获取与图片懒加载处理 |
| `pub mod char_wiki_detail_service` | mod.rs:4 | Wiki 物品详情批量/按需缓存 |
| `pub mod config_service` | mod.rs:5 | JSON 配置读写（app_config.json） |
| `pub mod data_query` | mod.rs:6 | 数据路径解析与 API 名枚举 |
| `pub mod game_launcher_service` | mod.rs:7 | 游戏启动器（其他文档负责） |
| `pub mod gacha_service` | mod.rs:8 | 抽卡记录抓取与本地存储 |
| `pub mod network_service` | mod.rs:9 | 统一数据查询入口（聚合子服务） |
| `pub mod skland_service` | mod.rs:10 | 森兰 API 底层调用（其他文档负责） |

**备注**：无 HTTP 端点、无配置键、无文件路径。`data_query` 是纯函数模块（含单元测试），不属于「服务实例」。

---

## `src-tauri/src/services/config_service.rs`
**职责**：以 `HashMap<String, Value>` 为内存缓存的 JSON 配置读写服务，读写 `app_config.json`，每次写操作同步落盘（pretty JSON）。

**导出**：
- `pub struct ConfigService { config_path: PathBuf, cache: Mutex<HashMap<String, Value>> }`
- `pub fn new() -> Result<Self, AppError>`
- `pub fn get<T: DeserializeOwned>(&self, key) -> Option<T>`
- `pub fn set(&mut self, key: String, value: Value) -> Result<(), AppError>`
- `pub fn remove(&mut self, key: &str) -> bool`
- `pub fn get_all(&self) -> HashMap<String, Value>`
- `fn save(&self)`（私有）

**状态**：在 `lib.rs:151-154` 创建为 `Arc<std::sync::Mutex<ConfigService>>` 并 `app.manage(...)`；同时注入 `SklandService`、`AccountService`（经 `AccountService::get_config_service()` 暴露）和 `tray::setup_tray`。因写方法需要 `&mut self`，调用方一律先 `lock()`。

| 符号 | 位置 | 说明 |
| --- | --- | --- |
| `ConfigService::new` | config_service.rs:18 | 创建 `app_data_dir()`（`%LOCALAPPDATA%\cn.msk-network.endprotocol`）并 `create_dir_all`；`config_path = paths::config_file_path()`；若文件存在则读入并 `serde_json::from_str::<HashMap<..>>`（解析失败回退空 map）。 |
| `ConfigService::get` | config_service.rs:44 | 输入 `key: &str`；锁 cache 后 `serde_json::from_value` 反序列化为 `T`，失败或 key 不存在返回 `None`。无磁盘读取。 |
| `ConfigService::set` | config_service.rs:55 | 输入 key/value；插入 cache 后立即 `save()` 写盘。锁失败转 `AppError::ConfigError`。 |
| `ConfigService::remove` | config_service.rs:67 | 删除 key，返回是否真的存在；删除成功才 `save()`（失败被忽略）。 |
| `ConfigService::get_all` | config_service.rs:79 | 克隆整份 cache 返回（`unwrap()` 可能 panic）。 |
| `ConfigService::save` | config_service.rs:85 | `serde_json::to_string_pretty` 后 `fs::write(config_path)`。 |

**备注**：
- 文件路径：`%LOCALAPPDATA%\cn.msk-network.endprotocol\app_config.json`（`utils/paths.rs:34`）。
- 已知配置键（散布于调用方）：`capture_autostart`（lib.rs:159）、`close_action`（lib.rs:226）、`tray_user_info`（tray.rs:13/25）、`lazy_load_enabled`（account_service.rs:369）、`account_list`（account_service.rs:1525）、`account_token_{id}` / skland token 键（account_service.rs:128 等）、`did_cache`（skland_service.rs:535）、`skland_games_cache`（account_service.rs:2578）。
- 调用方：`commands/account.rs:28`、`commands/attendance.rs:19`、`commands/gacha.rs:20`（`get_all()`）；`set/remove` 全部由 `account_service.rs`、`skland_service.rs`、`tray.rs` 调用。

---

## `src-tauri/src/services/avatar_cache_service.rs`
**职责**：远程图片（头像/图标/立绘等）的本地磁盘缓存服务：按图片类型分子目录存储、命中即返回本地路径、未命中则带 `Referer` 下载；另维护「URL → 子目录」全局注册表供前端按需下载时定位目录。

**导出**：
- 自由函数 `pub fn register_url_subdir(url, subdir)`、`pub fn resolve_url_subdir(url) -> Option<String>`、`pub fn all_sub_dir_names() -> &'static [&'static str]`
- `pub enum ImageType { Avatar, SkillIcon, WeaponIcon, EquipIcon, Illustration, AttendanceIcon, GemIcon, ItemIcon, AchievementIcon }` 与 `impl ImageType { pub fn dir_name(&self) -> &str }`
- `pub struct ImageCacheService { cache_dir: PathBuf }`，方法：`new`、`cache_dir`、`local_path_if_cached`、`get_or_download_image`、`get_or_download_avatar`、`clear_cache`
- `pub type AvatarCacheService = ImageCacheService;`（向后兼容别名，avatar_cache_service.rs:239）

**状态**：在 `lib.rs:185-186` 创建为 `Arc<AvatarCacheService>`，**未** `app.manage`，而是注入 `NetworkService::new`（network_service.rs:26）与 `AccountService::new`（lib.rs:202），经 `AccountService::avatar_cache_service()` 取用。`char_detail_service.rs:239` 每次处理图片时另建临时实例。

| 符号 | 位置 | 说明 |
| --- | --- | --- |
| `register_url_subdir` | avatar_cache_service.rs:14 | 输入 URL 与子目录名，写入 `OnceLock<Mutex<HashMap<String,String>>>` 全局注册表（空 URL 跳过）。由 `char_detail_service::localize_or_keep`（char_detail_service.rs:18）调用。 |
| `resolve_url_subdir` | avatar_cache_service.rs:25 | 按 URL 查询子目录名；被 `commands/image.rs:63`（`download_image` 的空 `sub_dir` 分支）调用。 |
| `all_sub_dir_names` | avatar_cache_service.rs:34 | 返回 10 个子目录：`avatars`、`skill_icons`、`weapon_icons`、`equip_icons`、`illustrations`、`attendance`、`gem_icons`、`item_icons`、`achv_icons`、`misc`。被 `local_path_if_cached`（:135）与 `commands/image.rs:70` 调用。 |
| `ImageType::dir_name` | avatar_cache_service.rs:65 | 枚举 → 子目录名（无 `misc`，`misc` 仅为下载兜底目录）。 |
| `ImageCacheService::new` | avatar_cache_service.rs:86 | 数据来源：`paths::image_cache_dir()` = `%LOCALAPPDATA%\cn.msk-network.endprotocol\image_cache`；创建主目录及 9 个类型子目录。 |
| `ImageCacheService::cache_dir` | avatar_cache_service.rs:113 | 返回缓存根目录；被 `char_detail_service.rs:496/656` 用于拼 `gem_icons` 路径。 |
| `extract_filename_from_url` | avatar_cache_service.rs:118 | 私有；取 URL 最后一个 `/` 段作为文件名（不剥离 query，与 `commands/image.rs:208` 的实现不同）。 |
| `local_path_if_cached` | avatar_cache_service.rs:130 | 输入 URL；`file://`、`http://asset.localhost` 直接原样返回；否则遍历 10 个子目录找同名文件，命中返回绝对路径，否则 `None`。不触发下载。被 `char_detail_service.rs:19` 调用。 |
| `get_or_download_image` | avatar_cache_service.rs:145 | 输入 URL + `ImageType`。本地/asset URL 直接返回；已有文件返回路径；否则 `GET {url}`，请求头 `Referer: https://game.skland.com/`（经 `capture::send` 走录制通道），日志记录请求/响应，`fs::write` 到 `image_cache/{dir_name}/{filename}`，返回本地路径。输出 `Result<String, AppError>`。调用方：`commands/attendance.rs:151`（`get_attendance`，`ImageType::AttendanceIcon`）、`char_detail_service.rs:671`（`ImageType::GemIcon`）。 |
| `get_or_download_avatar` | avatar_cache_service.rs:208 | `get_or_download_image(url, ImageType::Avatar)` 的别名。调用方：`account_service.rs:1177/1289/1675/1772/2420/2780`（角色头像落盘）。 |
| `clear_cache` | avatar_cache_service.rs:213 | 删除整个 `image_cache` 目录后重建主目录与 9 个类型子目录。**当前无调用方**。 |

**备注**：
- HTTP 端点：任意图片 URL，`GET`，唯一请求头 `Referer: https://game.skland.com/`。
- 文件路径：`%LOCALAPPDATA%\cn.msk-network.endprotocol\image_cache\{avatars|skill_icons|weapon_icons|equip_icons|illustrations|attendance|gem_icons|item_icons|achv_icons|misc}\{filename}`。
- 被命令调用：`commands/image.rs::download_image`（用到 `resolve_url_subdir`/`all_sub_dir_names`，但不经过本服务实例）、`commands/attendance.rs::get_attendance`（`get_or_download_image`）。

---

## `src-tauri/src/services/data_query.rs`
**职责**：纯函数工具模块——定义可被字符串解析的「数据 API 名」枚举，以及点分 JSON 路径（含数组索引）的解析与取值，供 `NetworkService::query_role_data` 做字段级抽取。

**导出**：
- `pub enum DataApi { CharDetail, WikiCatalog, WikiCatalogChar, WikiCatalogWeapon, WikiCatalogNoOnline, CharWikiDetail }`（`Display` + `FromStr`）
- `pub enum PathSegment { Field(String), Index(usize) }`（`Display`）
- `pub fn parse_path(path: &str) -> Vec<PathSegment>`
- `pub fn get_value_by_path(value: &Value, segments: &[PathSegment]) -> Option<Value>`
- 私有测试模块 `mod tests`（:129-199）

**状态**：不注册 State，无实例，无 I/O。

| 符号 | 位置 | 说明 |
| --- | --- | --- |
| `DataApi` | data_query.rs:6 | 6 个变体；字符串形式见 `Display`（data_query.rs:21）与 `FromStr`（data_query.rs:34）：`char_detail`、`wiki_catalog`、`wiki_catalog_char`、`wiki_catalog_weapon`、`wiki_catalog_no_online`、`char_wiki_detail`。未知串返回 `Err(String)`。 |
| `PathSegment` | data_query.rs:52 | 字段名 `Field` 渲染为 `name`，索引 `Index` 渲染为 `[n]`。 |
| `parse_path` | data_query.rs:70 | 输入如 `base.name`、`chars.0.charData.id`、`chars.[0].name`；按 `.` 切分，`[n]` 或纯数字解析为 `Index`，否则 `Field`；空串返回空 vec，空段跳过。 |
| `get_value_by_path` | data_query.rs:105 | 空 segments 返回整值克隆；对象取 `Field`、数组取 `Index`，类型不匹配或缺键返回 `None`。 |

**备注**：仅被 `network_service.rs:7/100/174/175` 使用；`WikiCatalogNoOnline` 为调试用 API 名。无 HTTP、无缓存、无配置键。

---

## `src-tauri/src/services/network_service.rs`
**职责**：统一数据查询入口（聚合器）：持有 `SklandService` / `CharDetailService` / `CharWikiDetailService` 与当前角色 ID，把 `query_role_data` 的 API 名分发到对应子服务，再按点分路径抽取字段返回 `HashMap<path, Value>`。

**导出**：
- `pub use crate::services::char_detail_service::PreloadRoleInfo;`（向后兼容重导出，:13）
- `pub struct NetworkService { skland_service: Arc<SklandService>, char_detail_service: CharDetailService, char_wiki_detail_service: Arc<CharWikiDetailService>, current_role_id: Arc<Mutex<Option<String>>> }`
- 方法：`new`、`skland_service()`、`char_detail_service()`、`char_wiki_detail_service()`、`get_current_role_id`、`set_current_role_id`、`retain_only_char_detail`、`preload_all_char_details`、`query_role_data`

**状态**：**不**直接 `app.manage`；在 `lib.rs:193-196` 创建为 `Arc<NetworkService>` 并注入 `AccountService::new`（lib.rs:203），经 `AccountService::get_network_service()`（account_service.rs:3071）与 `network_service()`（:355）访问。

| 符号 | 位置 | 说明 |
| --- | --- | --- |
| `NetworkService::new` | network_service.rs:24 | 输入 `Arc<SklandService>`、`Arc<AvatarCacheService>`；内部构造 `CharDetailService`（复用两者）与 `Arc<CharWikiDetailService>`（仅 skland），`current_role_id` 初始化为 `None`。 |
| `skland_service` / `char_detail_service` / `char_wiki_detail_service` | network_service.rs:39/43/47 | 只读访问器；`char_wiki_detail_service()` 目前无外部调用方。 |
| `get_current_role_id` | network_service.rs:51 | 读 `current_role_id`；调用方 `account_service.rs:415`。 |
| `set_current_role_id` | network_service.rs:55 | 输入 `(Option<String>, lazy_load_enabled)`；更新当前角色；若启用懒加载且角色发生变化，调用 `char_detail_service.remove(&old_id)` 释放旧角色缓存。调用链：`commands/account.rs::set_current_role_id`(:318) → `account_service.rs:495` → 本方法。 |
| `retain_only_char_detail` | network_service.rs:70 | 输入 `Option<String>`，仅保留该角色的两份缓存，其余清空。调用方 `account_service.rs:416`。 |
| `preload_all_char_details` | network_service.rs:75 | 输入 `&[PreloadRoleInfo]`，转调 `char_detail_service.preload_all`。调用方 `account_service.rs:482`。 |
| `query_role_data` | network_service.rs:83 | 输入 `role_id, api_name, paths, cred, token, server_id, user_id`；`api_name.parse::<DataApi>()` 后分发：<br>· `char_detail` → `CharDetailService::get_processed`<br>· `wiki_catalog` → `GET https://zonai.skland.com/web/v1/wiki/item/catalog?typeMainId=1&onlyOnline=true`<br>· `wiki_catalog_char` → 同路径 `?typeMainId=1&typeSubId=1`<br>· `wiki_catalog_weapon` → 同路径 `?typeMainId=1&typeSubId=2`<br>· `wiki_catalog_no_online` → 同路径 `?typeMainId=1`<br>· `char_wiki_detail` → 遍历 `paths`（当作 itemId）逐个 `CharWikiDetailService::get_item`，单条失败写入 `Null`，**直接返回**不走路径抽取<br>其余分支：`paths` 为空返回 `{"__full__": 整值}`，否则逐路径 `parse_path`+`get_value_by_path`，缺值填 `Null`。返回 `HashMap<String, Value>`。 |

**备注**：
- HTTP：全部经 `SklandService::call_skland_api`，基址 `https://zonai.skland.com`；请求头 `cred`、`dId`、`sign`、`timestamp`、`platform: 1`、`vName: 1.45.1`、`Content-Type: application/json`、`Origin/Referer: https://game.skland.com`（签名计算见 skland_service.rs:549，签名输入为 query 串）。角色详情数据源为 `GET https://zonai.skland.com/api/v1/game/endfield/card/detail?roleId=&serverId=&userId=`（skland_service.rs:742 起）。
- 调用方命令：`commands/account.rs::query_role_data`（:341，经 `account_service.rs:3076`）、`commands/account.rs::set_current_role_id`（:318）；`commands/gacha.rs:357` 经 `account.query_role_data(..., "wiki_catalog", &[])` 间接调用。
- 无自有缓存文件；缓存全部下沉到 `CharDetailService`（内存）与 `CharWikiDetailService`（内存+磁盘）。

---

## `src-tauri/src/services/char_detail_service.rs`
**职责**：角色（干员）详情的获取 + 双层内存缓存（原始 `CharDetailData` 与处理后 JSON），并对详情内所有图片 URL 做「已缓存替换为本地路径 / 未缓存保留远程 URL + 登记子目录」的懒加载处理（含基质图标按 Wiki 目录反查下载）。

**导出**：
- `pub struct PreloadRoleInfo { role_id, server_id, user_id, cred, token }`（:25）
- `pub struct CharDetailService { skland_service: Arc<SklandService>, avatar_cache_service: Arc<AvatarCacheService>, cache: Arc<Mutex<HashMap<String, CharDetailData>>>, processed_cache: Arc<Mutex<HashMap<String, Value>>> }`
- 方法：`new`、`cache`、`processed_cache`、`get_with_cache`、`preload_all`、`retain_only`、`remove`、`get_processed`（`process_images`、`cache_equip_icon`、`cache_gem_icon`、`cache_domain_avatars`、`cache_achieve_icons` 为私有）

**状态**：**不**单独注册；作为 `NetworkService` 的内联字段（network_service.rs:18，非 Arc 包裹），仅能通过 `NetworkService::char_detail_service()` 访问；其内部两个 `Arc<Mutex<..>>` 缓存可跨实例共享。

**内部结构**

| 区间 | 内容 |
| --- | --- |
| 1-22 | `localize_or_keep` 懒加载辅助：登记 URL 子目录 + 本地命中则替换路径 |
| 24-31 | `PreloadRoleInfo` 定义 |
| 33-59 | 结构体、`new`、`cache()`/`processed_cache()` 访问器 |
| 61-97 | `get_with_cache`（原始详情缓存） |
| 99-139 | `preload_all`（批量预取） |
| 141-177 | `retain_only` / `remove`（缓存裁剪） |
| 179-227 | `get_processed`（处理后 JSON 缓存） |
| 229-370 | `process_images`（遍历角色/技能/天赋/装备/成就/秘境） |
| 372-395 | `cache_equip_icon`（weaponData/equipData/tacticalItemData 的 iconUrl） |
| 397-680 | `cache_gem_icon`（Wiki 目录反查基质图标并下载） |
| 682-719 | `cache_domain_avatars`（秘境结算 officerCharAvatar） |
| 721-759 | `cache_achieve_icons`（成就 4 个 icon 字段） |
| 762-778 | `update_gem_icon_path` 自由函数（写回 `weapon.gem.gemData.icon`） |

| 符号 | 位置 | 说明 |
| --- | --- | --- |
| `localize_or_keep` | char_detail_service.rs:14 | 输入 `&mut String` URL、`ImageCacheService`、`ImageType`；空或 `http://asset.localhost` 跳过；否则 `register_url_subdir` + 本地命中则覆写为本地路径。 |
| `CharDetailService::new` | char_detail_service.rs:41 | 注入 `Arc<SklandService>`、`Arc<AvatarCacheService>`，两份空 `HashMap` 缓存。 |
| `cache` / `processed_cache` | char_detail_service.rs:53/57 | 返回内部 `Arc<Mutex<..>>` 引用；当前无外部调用方。 |
| `get_with_cache` | char_detail_service.rs:62 | 输入 `role_id, cred, token, server_id, user_id`；命中 `cache` 直接返回；否则 `SklandService::get_role_detail`（`GET https://zonai.skland.com/api/v1/game/endfield/card/detail?roleId=..&serverId=..&userId=..`，`cred`/`sign` 等头）取 `data.detail` 写入缓存。返回 `Option<CharDetailData>`。 |
| `preload_all` | char_detail_service.rs:100 | 输入 `&[PreloadRoleInfo]`，逐个跳过已缓存者并请求，单个失败仅告警（不中断）。调用方 `NetworkService::preload_all_char_details`。 |
| `retain_only` | char_detail_service.rs:142 | 保留指定 role 的两份缓存条目、清空其余；`None` 全清。 |
| `remove` | char_detail_service.rs:167 | 从两份缓存中删除该 role。由 `NetworkService::set_current_role_id` 懒加载分支调用。 |
| `get_processed` | char_detail_service.rs:182 | 先查 `processed_cache`；未命中则 `get_with_cache` → `process_images` → `serde_json::to_value` → 写入 `processed_cache`。返回 `Value`。被 `NetworkService::query_role_data` 的 `char_detail` 分支调用（最终来自 `commands/account.rs::query_role_data`）。 |
| `process_images` | char_detail_service.rs:231 | 新建 `ImageCacheService`；对每个角色处理 `avatar_sq_url`/`avatar_rt_url`（Avatar）、`illustration_url`（Illustration）、技能与 skill form 图标、`ability_talents`/`combat_talents`/`cultivation_talents` 的 `icon_url`+`locked_icon_url`（SkillIcon）、6 处装备图标（`weaponData`→WeaponIcon，`equipData`/`tacticalItemData`→EquipIcon）、基质图标、成就图标、秘境结算头像。 |
| `cache_equip_icon` | char_detail_service.rs:373 | 输入 `&mut Option<Value>`、`data_key`、`image_type`；在 `{data_key}.iconUrl` 上调用 `localize_or_keep`。 |
| `cache_gem_icon` | char_detail_service.rs:400 | 从 `weapon.gem.gemData` 取 `icon`/`name`/`templateId`（rarity = 去掉 `item_gem_rarity_` 前缀）；①本地 `image_cache/gem_icons/{原URL文件名}` 命中即回写；②否则 `GET https://zonai.skland.com/web/v1/wiki/item/catalog?typeMainId=1&typeSubId=7`（`call_skland_api`，带 cred/sign 头）取 `data.catalog[0].typeSub[0].items`，按名称首 2/末 2 字符 + `tagIds` 以 `000{rarity}` 结尾匹配，取 `brief.cover`；③`GET {cover_url}`（`Referer: https://game.skland.com/`）下载写入 `gem_icons/{原URL文件名}` 并回写路径。失败均仅告警。 |
| `cache_domain_avatars` | char_detail_service.rs:683 | 遍历 `domain[].settlements[].officerCharAvatar`，`localize_or_keep(.., Avatar)`。 |
| `cache_achieve_icons` | char_detail_service.rs:722 | 遍历 `achieve.achieveMedals[].achievementData` 的 `initIcon`/`reforge2Icon`/`reforge3Icon`/`platedIcon`，`localize_or_keep(.., AchievementIcon)`。 |
| `update_gem_icon_path` | char_detail_service.rs:763 | 自由函数；把本地路径写回 `weapon.gem.gemData.icon`。 |

**备注**：
- HTTP 端点：`https://zonai.skland.com/api/v1/game/endfield/card/detail`（带 cred/dId/sign/timestamp 头）、`https://zonai.skland.com/web/v1/wiki/item/catalog?typeMainId=1&typeSubId=7`、任意 `cover_url`（`Referer: https://game.skland.com/`）。
- 缓存路径：`%LOCALAPPDATA%\cn.msk-network.endprotocol\image_cache\gem_icons\{filename}`（本服务直接写盘处）；其他图片按类型落在 `image_cache/{dir_name}/`。
- 无配置键；缓存均为进程内 `HashMap`，生命周期随 `NetworkService`。
- 被调用：`NetworkService`（query_role_data / preload_all_char_details / retain_only_char_detail / set_current_role_id），间接触发命令 `commands/account.rs::query_role_data`、`set_current_role_id`，以及 `commands/gacha.rs:357`（`wiki_catalog` 不走本服务，仅同属 query_role_data）。

---

## `src-tauri/src/services/char_wiki_detail_service.rs`
**职责**：Wiki 物品详情缓存服务：从 catalog 提取全部 `itemId` 批量拉取详情并合并成 `{"itemId": {...}}`，支持「内存 → 磁盘 JSON → API」三级读取、后台预加载进度上报与 epoch 取消。

**导出**：
- `pub struct PreloadProgress { in_progress, completed, failed, total }`（:15，`Serialize`）
- `pub struct CharWikiDetailService { skland_service, cache, merged, initialized, preload_epoch, preload_in_progress, preload_progress, cache_dir }`
- 方法：`new`、`is_initialized`、`has_data`、`is_preload_in_progress`、`get_preload_progress`、`initialize`、`preload_all`、`clear`、`get_processed`、`get_item`（`save_to_disk`、`load_from_disk`、`fetch_item`、`fetch_all`、`extract_item_ids`、`disk_cache_path` 为私有）

**状态**：在 `NetworkService::new`（network_service.rs:33）中创建为 `Arc<CharWikiDetailService>` 并作为字段持有；**未** `app.manage`，只能经 `NetworkService::char_wiki_detail_service()` 取得（当前无外部调用方）。

**内部结构**

| 区间 | 内容 |
| --- | --- |
| 13-20 | `PreloadProgress` 定义 |
| 22-56 | 结构体与 `new`（含 cache_dir 解析） |
| 58-82 | 初始化/数据/进度状态查询 |
| 84-130 | 磁盘缓存读写（`disk_cache_path`/`save_to_disk`/`load_from_disk`） |
| 132-176 | `initialize` / `preload_all` / `clear` |
| 178-182 | `get_processed` |
| 184-239 | `fetch_item` / `get_item` |
| 241-328 | `fetch_all`（带进度与取消） |
| 330-353 | `extract_item_ids` |

| 符号 | 位置 | 说明 |
| --- | --- | --- |
| `CharWikiDetailService::new` | char_wiki_detail_service.rs:40 | `cache_dir = paths::wiki_detail_cache_dir()`（失败回退相对路径 `wiki_detail_cache`）；初始化 `cache`/`merged` 空结构与各原子量。 |
| `is_initialized` / `has_data` | char_wiki_detail_service.rs:58/62 | 读 `initialized` 原子量 / 判断 `merged` 对象非空。**无调用方**。 |
| `is_preload_in_progress` / `get_preload_progress` | char_wiki_detail_service.rs:68/74 | 返回预加载状态与 `(completed, failed, total)` 快照。**无调用方**（`PreloadProgress` 未被任何 command 序列化）。 |
| `disk_cache_path` | char_wiki_detail_service.rs:84 | `{cache_dir}/{itemId}.json`。 |
| `save_to_disk` | char_wiki_detail_service.rs:88 | 建目录后 `serde_json::to_string` 写 `{itemId}.json`，失败仅告警。 |
| `load_from_disk` | char_wiki_detail_service.rs:112 | 读并解析 `{itemId}.json`，存在但解析失败返回 `None`。 |
| `initialize` | char_wiki_detail_service.rs:137 | 输入 `catalog, cred, token, preload: bool`；`initialized.swap(true)` 保证只跑一次；`preload=false` 仅标记懒加载；`true` 则 `fetch_all`。**无调用方**。 |
| `preload_all` | char_wiki_detail_service.rs:159 | 不受 `initialized` 限制强制全量重拉，成功后覆盖 `merged`。**无调用方**。 |
| `clear` | char_wiki_detail_service.rs:165 | `preload_epoch += 1` 取消进行中的拉取、重置进度与 `initialized`、清空内存缓存并删除整个 `cache_dir`。**无调用方**。 |
| `get_processed` | char_wiki_detail_service.rs:179 | 返回 `merged` 克隆。**无调用方**。 |
| `fetch_item` | char_wiki_detail_service.rs:186 | `GET https://zonai.skland.com/web/v1/wiki/item/info?id={itemId}`（经 `call_skland_api`，cred/dId/sign/timestamp 头）；写盘 + 写 `cache` + 写 `merged`。 |
| `get_item` | char_wiki_detail_service.rs:214 | 三级查找：内存 `cache` → 磁盘（命中则回填两层缓存）→ `fetch_item`。被 `NetworkService::query_role_data` 的 `char_wiki_detail` 分支调用（命令 `commands/account.rs::query_role_data`，api_name = `char_wiki_detail`）。 |
| `fetch_all` | char_wiki_detail_service.rs:247 | `extract_item_ids` 后清空 `merged`、置进度 `(0,0,total)`；逐 item：先查磁盘，否则请求 `/web/v1/wiki/item/info`；每条前后检查 `preload_epoch`，变化即中止并丢弃；成功增量写 `merged` 供前端看部分数据；结束时 `preload_in_progress=false`。 |
| `extract_item_ids` | char_wiki_detail_service.rs:331 | 遍历 `data.catalog[].typeSub[].items[].itemId` 收集去重（不去重，顺序 push）。 |

**备注**：
- HTTP 端点：`GET https://zonai.skland.com/web/v1/wiki/item/info?id={itemId}`；请求头同 `call_skland_api`（`cred`/`dId`/`sign`/`timestamp`/`platform: 1`/`vName: 1.45.1`/`Origin+Referer: https://game.skland.com`）。
- 磁盘缓存路径：`%LOCALAPPDATA%\cn.msk-network.endprotocol\wiki_detail_cache\{itemId}.json`（`utils/paths.rs:24`）。
- 无配置键；进度通过自身状态暴露（未接事件/命令）。

---

## `src-tauri/src/services/gacha_service.rs`
**职责**：抽卡（寻访）记录服务：调用 ef-webview 抽卡 API 分页抓取角色/武器寻访记录，按 `seqId` 增量同步与去重合并，落盘到 `gacha_records/` 目录，并管理角色头像映射与全量 Wiki 目录缓存；同步进度通过 Tauri 事件推送给前端。

**导出**：
- `pub const GACHA_SYNC_PROGRESS_EVENT: &str = "gacha-sync-progress";`（:22）
- `pub struct GachaService { app_handle: Option<AppHandle> }`
- 方法：`new`、`get_pool_meta`、`get_records_page`、`get_weapon_records_page`、`fetch_pool_records_all`、`records_file_path`、`load_records`、`load_records_or_empty`、`save_records`、`weapon_records_file_path`、`load_weapon_records`、`load_weapon_records_or_empty`、`save_weapon_records`、`avatar_map_file_path`、`load_avatar_map`、`save_avatar_map`、`total_catalog_file_path`、`load_total_catalog`、`save_total_catalog`、`sync_records`、`sync_weapon_records`、`merge_weapon_records`、`build_weapon_pools_map`、`merge_records`、`build_pools_map`、`pool_type_of_pool_id`、`group_records_by_pool`、`count_by_rarity`、`count_by_char`（`fetch_pool_records_until_overlap`、`read_records_file`、`now_ms`、`emit_progress`、`get_api` 为私有）

**状态**：`lib.rs:189-190` 创建为 `Arc<GachaService>` 并 `app.manage(...)`；命令以 `State<'_, Arc<GachaService>>` 注入。字段 `app_handle` 用于 `emit` 进度事件。

**内部结构**

| 区间 | 内容 |
| --- | --- |
| 15-22 | 常量：`EF_WEBVIEW_BASE`、`GACHA_USER_AGENT`、`GACHA_SYNC_PROGRESS_EVENT` |
| 24-34 | 结构体与 `new` |
| 36-156 | API 层：`get_pool_meta`、`get_records_page`、`get_weapon_records_page`、`fetch_pool_records_all`、`fetch_pool_records_until_overlap` |
| 158-232 | 角色抽卡记录本地读写（含 legacy 路径回退） |
| 234-295 | 武器寻访记录本地读写 |
| 297-329 | 角色 id → 头像映射读写 |
| 331-385 | 全量 Wiki 目录 `total.json` 读写 |
| 387-485 | `sync_records`（角色增量同步主流程） |
| 487-631 | `sync_weapon_records` + 武器合并/池映射 |
| 633-741 | 工具方法（合并、分组、统计、`now_ms`） |
| 743-748 | `emit_progress`（进度事件） |
| 750-801 | `get_api`（统一 GET + code==0 校验） |

| 符号 | 位置 | 说明 |
| --- | --- | --- |
| `GachaService::new` | gacha_service.rs:30 | 仅保存 `AppHandle`。 |
| `get_pool_meta` | gacha_service.rs:39 | 输入 `u8token, server_id`；`GET https://ef-webview.hypergryph.com/api/record/char/meta?lang=zh-cn&token={u8token}&server_id={server_id}`；返回 `GachaMetaData`（Tab 列表）。被 `commands/gacha.rs::get_gacha_pool_meta`(:79) 调用。 |
| `get_records_page` | gacha_service.rs:50 | 输入 `u8token, server_id, pool_type, pool_id?, seq_id?`；`GET https://ef-webview.hypergryph.com/api/record/char` + `pool_type`/`pool_id`（joint 池需要）/`seq_id`（上一页末条）；返回 `GachaRecordData { list, has_more }`。被内部翻页调用（:122），无直接命令调用。 |
| `get_weapon_records_page` | gacha_service.rs:71 | 输入 `u8token, server_id, seq_id?`；`GET https://ef-webview.hypergryph.com/api/record/weapon?..&seq_id=`；返回 `GachaWeaponRecordData`。被 `sync_weapon_records`(:532) 调用。 |
| `fetch_pool_records_all` | gacha_service.rs:86 | 以空 `saved_seq_ids` 调 `fetch_pool_records_until_overlap`（全量拉取）。**无调用方**。 |
| `fetch_pool_records_until_overlap` | gacha_service.rs:107 | 私有；循环 `get_records_page`，逐条比对本地 `saved_seq_ids` 命中即停（该条不入库），`has_more=false` 或空页停止；每页更新 `GachaSyncProgress` 并 `emit_progress`；下一页 `seq_id` = 本页最后一条。 |
| `records_file_path` | gacha_service.rs:161 | 委托 `paths::gacha_records_file_path` = `%LOCALAPPDATA%\cn.msk-network.endprotocol\gacha_records\gacha_records_{userId}_{serverId}.json`。 |
| `load_records` | gacha_service.rs:168 | 读上述文件；不存在时回退旧路径 `gacha_records_{userId}_{serverId}.json`（与 app_config.json 同级，`paths.rs:70`）；都没有返回 `None`。 |
| `read_records_file` | gacha_service.rs:195 | 私有；读文件 + `serde_json::from_str`。 |
| `load_records_or_empty` | gacha_service.rs:202 | 不存在则返回空 `SavedGachaData`（`last_sync_time=None`）。调用：`commands/gacha.rs::get_saved_gacha_records`(:158)、`resolve_gacha_avatar_map`(:266)、`get_gacha_record_stats`(:490)。 |
| `save_records` | gacha_service.rs:219 | 建父目录后 pretty JSON 写盘。调用：`sync_records`(:462)。 |
| `weapon_records_file_path` | gacha_service.rs:237 | `gacha_records\gacha_weapon_records_{userId}_{serverId}.json`（`paths.rs:52`）。 |
| `load_weapon_records` / `load_weapon_records_or_empty` | gacha_service.rs:250/265 | 同角色逻辑，无 legacy 回退。调用：`commands/gacha.rs::get_saved_weapon_gacha_records`(:228)、`resolve_gacha_avatar_map`(:272)。 |
| `save_weapon_records` | gacha_service.rs:282 | pretty JSON 写盘。调用：`sync_weapon_records`(:567)。 |
| `avatar_map_file_path` | gacha_service.rs:300 | `%LOCALAPPDATA%\cn.msk-network.endprotocol\gacha_avatar_map.json`（`paths.rs:78`）。 |
| `load_avatar_map` | gacha_service.rs:307 | 读 charId → 头像 URL 映射，任何失败回空 map。调用：`commands/gacha.rs::resolve_gacha_avatar_map`(:335)。 |
| `save_avatar_map` | gacha_service.rs:318 | 空 map 不写盘；否则 pretty JSON。调用：同命令 :462。 |
| `total_catalog_file_path` | gacha_service.rs:334 | `gacha_records\total.json`（全局共用，`paths.rs:65`）。 |
| `load_total_catalog` | gacha_service.rs:342 | 读全量 Wiki 目录缓存；文件缺失/解析失败/`data.catalog[].typeSub[].items` 全为空（早期误用产生的无效数据）时返回 `None`。调用：`resolve_gacha_avatar_map`(:355)。 |
| `save_total_catalog` | gacha_service.rs:377 | 紧凑 JSON 写盘。调用：同命令 :361。 |
| `sync_records` | gacha_service.rs:393 | 输入 `user_id, server_id, u8token`。①读本地 `saved_seq_ids`；②`get_pool_meta` 取全部 Tab；③每个 Tab `fetch_pool_records_until_overlap` 增量拉取（每页推送 `gacha-sync-progress`）；④`merge_records` 去重合并 + `build_pools_map` 重建池信息 + 写 `last_sync_time`；⑤`save_records`；⑥`progress.done=true` 再推一次。返回 `GachaSyncResult { user_id, server_id, synced_at, new_records, total_records, per_tab_new }`。被 `commands/gacha.rs::sync_gacha_records`(:111) 调用。 |
| `sync_weapon_records` | gacha_service.rs:491 | 同上但无 meta：直接从最新按 `seq_id` 翻 `/api/record/weapon` 直到命中已存 `seqId`；`progress.tab_key="weapon"`、`tab_count=1`；合并用 `merge_weapon_records` + `build_weapon_pools_map`；`per_tab_new = {"weapon": n}`。被 `commands/gacha.rs::sync_weapon_gacha_records`(:174) 调用。 |
| `merge_weapon_records` | gacha_service.rs:593 | 按 `seqId` 去重（新在前），再按 `(seq_id 数值, gacha_ts_ms)` 降序排序，保证全局从新到旧。 |
| `build_weapon_pools_map` | gacha_service.rs:620 | 从记录提取 `poolId → GachaPoolInfo`，`pool_type` 固定 `E_WeaponGachaPoolType`。 |
| `merge_records` | gacha_service.rs:636 | 同 `merge_weapon_records` 的角色版（`GachaRecord`）。 |
| `build_pools_map` | gacha_service.rs:659 | 合并 meta Tab 提供的池（`label` → `pool_name`）与记录中出现的池。 |
| `pool_type_of_pool_id` | gacha_service.rs:687 | `joint_*` → `E_CharacterGachaPoolType_Joint`；`standard*` → `..._Standard`；其余 → `..._Special`。 |
| `group_records_by_pool` | gacha_service.rs:698 | 按 `pool_id` 分组（保持原顺序，即从新到旧）。调用：`commands/gacha.rs::get_gacha_record_stats`(:502)。 |
| `count_by_rarity` | gacha_service.rs:709 | 仅 `is_draw()` 记录，`rarity → count`。调用：同命令 :515。 |
| `count_by_char` | gacha_service.rs:723 | 仅 `is_draw()` 记录，`char_id → count`。调用：同命令 :516。 |
| `now_ms` | gacha_service.rs:736 | Unix 毫秒时间戳。 |
| `emit_progress` | gacha_service.rs:744 | `AppHandle::emit(GACHA_SYNC_PROGRESS_EVENT, progress)`，事件名 `gacha-sync-progress`。 |
| `get_api` | gacha_service.rs:752 | 私有统一 GET：URL = `{EF_WEBVIEW_BASE}{endpoint}`，`query_pairs_mut` 追加 `lang=zh-cn`、`token={u8token}`、`server_id` 及业务参数（URL 编码，避免 u8token 中 `+`/`/` 被误解析）；请求头 `User-Agent: GACHA_USER_AGENT`（抓包同款 QtWebEngine/Chrome UA，:19）、`Referer: https://ef-webview.hypergryph.com/page/gacha_char?u8_token={enc}&channel=1&lang=zh-cn&platform=Windows&server={enc}&subChannel=1`、`Accept: application/json, text/plain, */*`；`error_for_status` 后反序列化 `GachaApiResponse<T>`，`code != 0` 抛 `AppError::ApiError`，`data` 为 `None` 抛 `"empty data"`。 |

**备注**：
- HTTP 端点（基址 `https://ef-webview.hypergryph.com`）：
  - `GET /api/record/char/meta`
  - `GET /api/record/char`
  - `GET /api/record/weapon`
  - 公共 query：`lang=zh-cn`、`token`（u8token）、`server_id`；请求头：`User-Agent`（常量 `GACHA_USER_AGENT`）、`Referer`（gacha_char 页面带 u8_token/channel/platform/server/subChannel）、`Accept`。无签名。
- 文件/缓存路径（根目录均为 `%LOCALAPPDATA%\cn.msk-network.endprotocol`）：
  - `gacha_records\gacha_records_{userId}_{serverId}.json`（旧版：根目录同名文件，仅读兼容）
  - `gacha_records\gacha_weapon_records_{userId}_{serverId}.json`
  - `gacha_records\total.json`（全量 Wiki 目录缓存，全局共用）
  - `gacha_avatar_map.json`
- 事件：`gacha-sync-progress`（`GachaSyncProgress`：user_id、server_id、tab_index、tab_count、tab_key、page、tab_fetched、total_fetched、done）。
- 被命令调用：`commands/gacha.rs` 中 `get_gacha_pool_meta`、`sync_gacha_records`、`get_saved_gacha_records`、`sync_weapon_gacha_records`、`get_saved_weapon_gacha_records`、`resolve_gacha_avatar_map`、`get_gacha_record_stats`（全部以 `State<'_, Arc<GachaService>>` 注入）。u8token 来自同文件 `lookup_u8token` / `ensure_fresh_u8token`（读 `ConfigService` 并按需刷新 cred）。
