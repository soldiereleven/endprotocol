# GameLauncherService（启动器/下载/进程管理）— 功能参考

> 逐行精读源码生成。行号基于当前工作区版本，仅用于快速定位。
> 覆盖文件：`src-tauri/src/services/game_launcher_service.rs`（共 2960 行，其中非空 2623 行）。
> 「进程启动/检测/杀死」「磁盘空间」「渠道特征识别」**不在本文件**，位于 `src-tauri/src/commands/launcher.rs`，下文关键流程中单独标注其行号。

**文件职责**：游戏启动器后端核心服务，负责远程版本检查、文件清单下载解密、安装/更新（并发下载 + 断点续传 + MD5 校验 + 暂存原子应用）、完整性校验与修复、预下载（preload）、渠道切换（5 阶段带回滚）、Banner/公告/背景媒体获取，并维护全局下载/切换取消标志与「活跃操作」状态。

**状态注册方式**：`lib.rs:211-212` 创建 `Arc<tokio::sync::Mutex<GameLauncherService>>` 并 `app.manage(...)` 注入 Tauri State；所有 command（`commands/launcher.rs`）以 `tauri::State<'_, Arc<Mutex<GameLauncherService>>>` 取用，并在整段操作期间持有锁（因此 command 层天然串行）。取消类接口（`cancel_download` 等）是模块级自由函数，command 直接调用，不取锁。

**主要依赖**：`reqwest::Client`（双实例：30s 通用 / 1800s 下载，UA `EndProtocol/0.1.0`）；`futures_util::StreamExt`（字节流）；`tokio::sync::{Mutex, Semaphore}` + `tokio::task::JoinSet`（并发下载/校验）；`walkdir::WalkDir`（目录遍历）；`tauri::Emitter`（事件 emit）；`crate::models::game::*`（全部数据结构，定义在 `models/game.rs`）；`crate::utils::capture`（`send`/`send_stream`，网络录制包装，见 `utils/capture.rs:422/483`）；`crate::utils::hg_crypto`（AES-CBC 解密、MD5/SHA-256，见 `utils/hg_crypto.rs`）；`crate::utils::paths::app_data_dir()`（`utils/paths.rs:7`）；`uuid::Uuid`、`chrono`、`serde_json`、`tracing`。

## 内部结构总览

| 区间 | 内容 |
| --- | --- |
| 1-15 | `use` 导入（std/fs/io/path/atomic、futures_util、reqwest、tauri、tokio、walkdir、models、utils） |
| 17-35 | 模块级静态取消标志 `DOWNLOAD_CANCELLED`(L18)、`SWITCH_CANCELLED`(L19) 与 4 个自由函数 `cancel_download`/`reset_download_cancel`/`cancel_switch`/`reset_switch_cancel` |
| 37-79 | `cleanup_staging_files`：清理暂存目录与 `.download` 缓存 |
| 81-111 | `has_download_cache`：探测是否存在下载缓存 |
| 113-117 | `struct GameLauncherService` 字段定义 |
| 119-150 | `impl` 开头：`new`、`has_active_operation`/`set_active_operation`/`get_active_operation` |
| 152-313 | 版本检查：`get_latest_package`(155-249)、`check_status`(252-313) |
| 315-450 | 安装扫描与本地版本解析：`scan_install_dir`(316-411)、`read_local_version`(414-433)、`versions_equal`(436-450) |
| 452-575 | 清单下载与解析：`fetch_manifest`(455-489)、`parse_manifest`(492-542)、`validate_path`(545-575) |
| 577-614 | 计划生成：`plan_updates`(580-614) |
| 616-775 | 单文件下载：`download_file_with_resume`(619-749)、`download_and_verify`(752-775) |
| 777-1188 | 完整安装/更新：`install_or_update`(781-1164)、`apply_staged_files`(1167-1188) |
| 1189-1647 | 完整性校验与修复：`verify_and_repair`(1192-1647) |
| 1649-1908 | 预下载：`preload_download`(1652-1887)、`preload_staging_dir`(1890-1901)、`cleanup_preload_staging`(1904-1908) |
| 1910-2001 | 状态持久化：`save_payload_state`(1911-1948)、`load_payload_state`(1951-1956)、`get_payload_state`(1959-1961)、`save_preload_state`(1964-2001) |
| 2003-2080 | Web 批量代理：`batch_proxy_web`(2006-2080，含原始响应调试日志) |
| 2082-2162 | `get_banners`(2083-2111)、`get_announcements`(2114-2162) |
| 2164-2193 | `batch_proxy_web_raw`(2165-2193，返回原始 `serde_json::Value`) |
| 2195-2430 | `get_notice_content`(2195-2353)、`get_background_image`(2356-2415)、`classify_media_type`(2418-2430) |
| 2432-2756 | 渠道切换 `switch_channel`(2433-2756，5 阶段 + 事件 emit + 取消回滚) |
| 2759-2960 | 模块级 `async fn download_single_file`(2763-2960，实际批量下载的主力实现) |
| — | 文件内**不**包含进程启动/检测/杀死、磁盘空间、渠道 DLL 识别（见 `commands/launcher.rs`，见「关键流程」末两节） |

## 结构体与字段

### `GameLauncherService`（本文件 L113-117）

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `http_client` | `reqwest::Client` | 通用 API 客户端，超时 30s，UA `EndProtocol/0.1.0`（L121-125） |
| `download_client` | `reqwest::Client` | 下载客户端，超时 1800s（30 分钟），UA 同上（L127-131） |
| `active_operation` | `Arc<Mutex<Option<ActiveOperation>>>` | 当前活跃操作快照；仅 `switch_channel` 会写入/清空（见备注·异常 4） |

### 模块级静态

| 符号 | 类型 | 含义 |
| --- | --- | --- |
| `DOWNLOAD_CANCELLED` (L18) | `AtomicBool` | 全局下载/校验取消标志，被下载流、校验任务与 `verify_md5_with_cancel` 读取 |
| `SWITCH_CANCELLED` (L19) | `AtomicBool` | 切服取消标志，仅 `switch_channel` 各阶段检查 |

### 关键 payload 结构（定义均在 `models/game.rs`，本文件只使用）

| 结构 | 关键字段 | 说明 |
| --- | --- | --- |
| `RemotePackage` (game.rs:217) | `version: String`、`resource_base_url: String`、`has_preload: bool`、`preload_version: Option<String>`、`preload_resource_url: Option<String>` | 远程版本与资源基址（`get_latest_package` 输出） |
| `ManifestFile` (game.rs:209) | `path: String`、`md5: String`(32 hex)、`size: i64` | 解密后 NDJSON 清单单条 |
| `FilePlan` (game.rs:290) | `manifest: ManifestFile`、`source_path: Option<String>` | 本地已匹配则给源路径（可跳过下载） |
| `DownloadProgress` (game.rs:227) | `downloaded: u64`、`total: u64`、`stage: String`、`current_file: Option<String>`、`file_index: usize`、`file_count: usize`、`verified_bytes: u64` | 安装/校验/预下载进度 payload（`launcher-progress` 事件体） |
| `InstallStage` (game.rs:254) | `checking/comparing/downloading/verifying/repairing/applying/completed/error` | `DownloadProgress.stage` 取值 |
| `SwitchProgress` (game.rs:147) | `phase: String`、`downloaded/total: u64`、`current_file: Option<String>`、`file_index/file_count: usize`、`from_channel/to_channel: String` | 切服进度 payload；`phase` 实际取值 `checking`(L2477)、`downloading`(L2591/2606)、`backing_up`(L2677)、`moving`(L2726)、`completed`(L2746) |
| `ActiveOperation` (game.rs:121) | serde 标签 `type`：`installing`/`verifying`/`repairing` → `OperationProgress`；`switching` → `SwitchProgress` | 统一活跃操作枚举（`launcher://progress` 事件体） |
| `GameStatus` (game.rs:160) | `is_installed`、`has_update`、`local_version`、`remote_version`、`has_preload`、`preload_version`、`preload_completed`、`active_operation` | `check_status` 输出 |
| `FileScanResult` (game.rs:414) | `channel_detected`、`detected_channel`、`total_files`、`valid_files`、`corrupted_files`、`missing_files`、`existing_bytes`、`download_bytes`、`corrupted_file_list`(≤20)、`missing_file_list`(≤20) | `scan_install_dir` 输出 |
| `PayloadState` (game.rs:297) | `channel`、`version`、`manifest_sha256`、`file_count`、`total_bytes`、`updated_at`(RFC3339)、`preload_version?`、`preload_completed` | 落盘的安装状态 JSON 内容 |
| `BannerItem` / `AnnouncementItem` / `LauncherNoticeContent` / `BackgroundMedia` (game.rs:322/329/338/405) | banner：`image_url`+`jump_url`；公告：`category`+`title`+`date`+`jump_url`；notice：`banners`+`announcements`；背景：`image_url?`+`video_url?` | 公告/背景接口输出 |

## 方法清单（必须完整）

### 模块级自由函数

| 方法 | 位置 | 说明（输入 → 做什么 → 输出） |
| --- | --- | --- |
| `pub fn cancel_download` | L21-23 | 无输入 → 将 `DOWNLOAD_CANCELLED` 置 true → 无返回 |
| `pub fn reset_download_cancel` | L25-27 | 无输入 → 复位下载取消标志 → 无返回 |
| `pub fn cancel_switch` | L29-31 | 无输入 → 将 `SWITCH_CANCELLED` 置 true → 无返回 |
| `pub fn reset_switch_cancel` | L33-35 | 无输入 → 复位切服取消标志 → 无返回 |
| `pub fn cleanup_staging_files` | L38-79 | 输入 `install_path` → 删除 `{install_path}.switch.download`、父目录下 `{stem}.staging.*`/`{stem}.switch.*`/`{stem}.backup.*` 目录、安装目录内所有 `.download` 文件 → 无返回（失败忽略） |
| `pub fn has_download_cache` | L82-111 | 输入 `install_path` → 扫父目录 `{stem}.staging.*` 与安装目录内 `.download` 文件 → `bool` |
| `async fn download_single_file`（私有） | L2763-2960 | 输入 `url`、`dest_path`、`expected_md5`、共享 `dl_bytes: Arc<AtomicU64>`、`file_size` → 新建 600s 超时 client，`.download` 断点续传（Range），最多 3 次重试（退避 `attempt*2` 秒，重试从 0 开始），逐块写盘并累加计数器，全量读取算 MD5 比对，失败删临时文件 → `Ok(())`/`Err(String)` |

### `impl GameLauncherService` 方法

| 方法 | 位置 | 说明（输入 → 做什么 → 输出） |
| --- | --- | --- |
| `pub fn new` | L120-138 | 无输入 → 构造 30s/1800s 两个 `Client` 与空 `active_operation` → `Self`（构造失败 `expect` panic） |
| `pub async fn has_active_operation` | L140-142 | 无输入 → 读锁判断 `active_operation.is_some()` → `bool` |
| `pub async fn set_active_operation` | L144-146 | 输入 `Option<ActiveOperation>` → 覆盖写入 → 无返回 |
| `pub async fn get_active_operation` | L148-150 | 无输入 → 克隆当前活跃操作 → `Option<ActiveOperation>` |
| `pub async fn get_latest_package` | L155-249 | 输入 `&GameChannel` → 向 `channel.api_url()` POST `get_latest_game` 批量代理请求（`capture::send`），解析 `BatchProxyResponse`，校验 `file_path` 必须 `https://` 开头，提取 preload 信息 → `RemotePackage` |
| `pub async fn check_status` | L252-313 | 输入 channel + `install_path` → 判 exe/`config.ini` 是否齐全得 `is_installed`，读本地版本、请求远程版本做 `versions_equal` 得 `has_update`，结合持久化状态判定 `preload_completed`，附 `active_operation` → `GameStatus` |
| `pub async fn scan_install_dir` | L316-411 | 输入 channel + `install_path` → 取远程清单，逐条比对本地存在性/大小/MD5（错误路径各记 ≤20 条） → `FileScanResult`（`channel_detected` = exe+`Endfield_Data`+`config.ini` 三者齐全；`detected_channel` 恒回填传入渠道） |
| `fn read_local_version`（私有） | L414-433 | 输入 `install_path` → `hg_crypto::decrypt_file_to_string` 解密 `config.ini`，解析 `game_version`/`version` 行的 `=` 后值（去引号） → `Result<String,_>`，找不到报 `Version not found in config.ini` |
| `fn versions_equal`（私有关联 fn） | L436-450 | 输入两个版本串 → 去 `v/V` 前缀、截断 `-`/`+` 后缀、按 `.` 拆为 `u32` 数组比较 → `bool` |
| `pub async fn fetch_manifest` | L455-489 | 输入 `resource_base_url` → GET `{base}/game_files`，对密文算 SHA-256（作为 manifest 标识），AES 解密后按 NDJSON 解析 → `(Vec<ManifestFile>, manifest_sha256)` |
| `fn parse_manifest`（私有） | L492-542 | 输入解密文本 → 逐行 JSON 反序列化，执行路径安全校验、MD5 32 hex 校验、`size>=0` 校验、规范化路径查重、条目数 ≤100,000 → `Vec<ManifestFile>` |
| `fn validate_path`（私有关联 fn） | L545-575 | 输入清单路径 → 拒绝空路径、绝对路径（`/`、`\`）、含 `:`、`.`/`..` 段、Windows 保留名（CON/PRN/AUX/NUL/COM1-9/LPT1-9） → `Result<(),String>` |
| `pub fn plan_updates` | L580-614 | 输入清单 + `install_path` → 对每条检查本地文件大小与 MD5，匹配则填 `source_path` → `Vec<FilePlan>` |
| `pub async fn download_file_with_resume` | L619-749 | 输入 `url`、`dest_path`、进度回调 → `.download` 断点续传（Range；服务端 200 则从头），最多 3 次重试（退避 `attempt` 秒），每 256KB 触发一次回调，完成后改名到 `dest_path` → `Result<(),String>`（取消时删临时文件并返回 `Download cancelled`） |
| `pub async fn download_and_verify` | L752-775 | 输入 `url`、`dest_path`、`expected_md5`、回调 → 调上面函数下载后校验 MD5，不符则删文件并报错 → `Result<(),String>`（**全仓无外部调用**，见备注·异常 1） |
| `pub async fn install_or_update` | L781-1164 | 输入 channel、`install_path`、`Arc<dyn Fn(DownloadProgress)>` → 依次：检查(`checking`)→拉远程包→拉清单→比对(`comparing`)→复制已有文件到 `{install_path}.staging.{uuid}`→复用 preload 暂存文件→信号量并发 8 下载(`downloading`，后台 500ms 发一次进度)→全量 MD5 校验(`verifying`)→覆盖应用到安装目录(`applying`)→保存状态→清理暂存→回 `completed`/`error` → `Ok(版本号)` / `Err(前 5 个失败文件摘要)`；已有操作进行中直接报错 |
| `fn apply_staged_files`（私有） | L1167-1188 | 输入 staging、target 目录 → WalkDir 逐文件 `fs::copy` 覆盖到目标 → `Result<(),String>` |
| `pub async fn verify_and_repair` | L1192-1647 | 输入 channel、`install_path`、回调、`max_concurrent`(截断到 1..32)、`quick` → Phase1 并发检查存在性/大小/MD5（`quick` 跳过 MD5；MD5 走 `spawn_blocking` + `verify_md5_with_cancel`）收集修复清单 → Phase2 并发重新下载损坏文件 → 返回 JSON 字符串 `{ok, failed, repaired, files[]}` → `Result<String,String>` |
| `pub async fn preload_download` | L1652-1887 | 输入 channel、`install_path`、回调、`max_concurrent` → 取 `preload_resource_url`/`preload_version`，拉 preload 清单，并发下载到 `{install_path}.staging.preload.{uuid}`，再并发校验，最后 `save_preload_state(..., true)` → `Ok("Preload completed: N files")`（下载/校验失败仅记日志，仍写完成标记，见异常 7） |
| `fn preload_staging_dir`（私有） | L1890-1901 | 输入 `install_path` → 在父目录找 `{stem}.staging.preload.*` → `Option<String>` |
| `fn cleanup_preload_staging`（私有） | L1904-1908 | 输入 `install_path` → 删除找到的 preload 暂存目录 → 无返回 |
| `fn save_payload_state`（私有） | L1911-1948 | 输入 channel、`version`、`manifest_sha256`、`manifest` → 组装 `PayloadState`（保留既有 preload 字段）写 `game_state/{channel}.json.tmp` 再 rename（原子写） → `Result<(),String>` |
| `fn load_payload_state`（私有） | L1951-1956 | 输入 channel → 读并反序列化 `game_state/{channel}.json` → `Option<PayloadState>` |
| `pub async fn get_payload_state` | L1959-1961 | 输入 channel → 包装同步读取 → `Option<PayloadState>` |
| `fn save_preload_state`（私有） | L1964-2001 | 输入 channel、`preload_version`、`completed` → 读（或新建）状态后写回 preload 字段，临时文件 + rename → `Result<(),String>` |
| `async fn batch_proxy_web`（私有） | L2006-2080 | 输入 channel、`proxy_reqs` → 以 `{seq, proxy_reqs}` POST `channel.web_api_url()`，`eprintln!` 输出原始 `proxy_rsps` 调试信息（公告 tabs/banner 数量），再解析 → `BatchProxyResponse` |
| `pub async fn get_banners` | L2083-2111 | 输入 channel → 组 `get_banner` 请求（language `zh-cn`、platform `Windows`、source `launcher`） → `Vec<BannerItem>`（`url`→`image_url`、`jump_url`） |
| `pub async fn get_announcements` | L2114-2162 | 输入 channel → 组 `get_announcement` 请求，展平 tabs→announcements，`start_ts` 转 `%m/%d` → `Vec<AnnouncementItem>`（`category`=tab 名、`title`=content） |
| `async fn batch_proxy_web_raw`（私有） | L2165-2193 | 输入 channel、`proxy_reqs` → 同 POST web 批量代理但不解析结构 → 原始 `serde_json::Value`（其上的 doc 注释与实际功能错位，见异常 5） |
| `pub async fn get_notice_content` | L2195-2353 | 输入 channel → 一次发 `get_banner` + `get_announcement`（B 服强制改用官服参数，L2200-2204），手工遍历原始 JSON，兼容 `tabName/tab_name`、`start_ts/startTs`（支持秒/毫秒时间戳）、`jump_url/jumpUrl` → `LauncherNoticeContent` |
| `pub async fn get_background_image` | L2356-2415 | 输入 channel → 组 `get_main_bg_image` 请求，取 `main_bg_image.url`/`video_url`，用扩展名判定图片/视频并互换字段 → `Option<BackgroundMedia>` |
| `fn classify_media_type`（私有） | L2418-2430 | 输入 URL → 判 `.mp4/.webm/.ogg` 或带 `?` 后缀 → `"video"` / `"image"` |
| `pub async fn switch_channel` | L2433-2756 | 输入 `from_channel`、`to_channel`、`install_path`、`app: AppHandle` → 5 阶段：①拉双方远程包与清单做 diff（L2494-2549）②下载差异文件到 `{install_dir}/.switch.download`（优先复用 `.switch/{to_channel}` 备份，L2551-2648）③把待删文件备份到 `.switch/{from_channel}` 并删除（L2650-2695）④把暂存文件复制进安装目录（L2697-2741）⑤清理暂存、emit `completed`、清 `active_operation`（L2743-2755）；每阶段检查 `SWITCH_CANCELLED` 并回滚（恢复备份/删暂存） → `Ok(to_remote.version)` / `Err` |

> 方法总数 40：模块级 7（其中 pub 6）+ impl 内 33（其中 pub 20）。上表全部列出；加粗的 20 个 `pub` impl 方法与 6 个 pub 自由函数即全部公开 API。

## 关键流程

### 安装/更新检查（L152-450）
- `get_latest_package` L155-249：POST `get_latest_game`（请求体 `seq` + `proxy_reqs[{kind, get_latest_game_req{appcode, launcher_appcode, channel, sub_channel, version:""}}]`）→ 取 `get_latest_game_rsp.pkg.file_path` 作 `resource_base_url`，**强制 https**（L223-228）；若同时有 `preload_version`+`preload_pkg` 则 `has_preload=true`。
- `check_status` L252-313：`is_installed = 存在 {install}/Endfield.exe 且存在 {install}/config.ini`（L263-265）；本地版本来自解密的 `config.ini`（L414-433）；`has_update = 本地≠远程`（L278-283）；`has_preload = 已安装 && 无更新 && 远程有 preload`（L286）；`preload_completed` 读 `game_state/{channel}.json` 并校验 preload 版本一致（L289-299）。
- `scan_install_dir` L316-411：核心文件检查 L323-327；逐清单条目统计 missing/大小不符/MD5 不符与字节数 L343-392。
- `versions_equal` L436-450：语义化分段比较，忽略 `v` 前缀与 `-`/`+` 后缀。

### 清单下载与解析（L452-575）
- `GET {resource_base_url}/game_files`（L459）→ 密文 SHA-256（L477，作为 `PayloadState.manifest_sha256`）→ AES-256-CBC 解密（L481）→ NDJSON 逐行解析。
- 校验规则：路径安全（L506，防穿越/保留名）、MD5 32 hex（L509-515）、`size>=0`（L517-519）、重复路径（L521-529，`\` 归一 `/`）、上限 100,000 条（L534-539）。

### 下载与断点续传（L616-775、L2763-2960）
- 两条实现：`download_file_with_resume`（L619-749，带进度回调，256KB/次）与 `download_single_file`（L2763-2960，实际批量使用，共享 `AtomicU64` 计数，4MB/次日志）。
- 断点续传：读 `{dest}.download` 现有长度作为 `start_byte`（L636-647 / L2779-2791），带 `Range: bytes={n}-`（L662 / L2819）；若服务端回 200（忽略 Range）则从 0 重下（L677-679 / L2840-2846）；206 走追加模式，否则新建（L683-694 / L2858-2866）。
- 重试：3 次；`download_file_with_resume` 退避 `attempt` 秒（L652-658），`download_single_file` 退避 `attempt*2` 秒（L2802-2815），重试均从 0 开始。
- 取消：流式循环中每块检查 `DOWNLOAD_CANCELLED`，命中即删 `.download` 并返回（L702-706 / L2874-2879）。
- 校验：`download_single_file` 全量读文件算 MD5 比对（L2912-2928，不符删临时文件）；`download_file_with_resume` 内的 MD5 校验为恒真空操作（L724-730，见异常 2）。
- 完成后 `fs::rename(.download → dest)`（L733 / L2931）。

### 完整安装/更新（L777-1188）
阶段与进度（`InstallStage`）：`checking` L796-804 → 拉包 L806 / 拉清单 L815 → `comparing` L820-828（计划 L830-842，全新则直接保存状态返回 L844-849）→ 建 `{install_path}.staging.{uuid}` L852-858 → 复制已存在文件到暂存 L861-882 → preload 复用（校验大小+MD5 后复制，成功则从下载列表剔除并清理 preload 暂存）L890-936 → `downloading`（信号量并发 8，L946-947；后台任务每 500ms 发进度，L950-973；任务逐个 spawn L975-1017；汇总失败文件 L1019-1062）→ `verifying`（全清单 MD5，每 500 条回调，L1069-1106）→ `applying`（`apply_staged_files` 覆盖到安装目录，L1110-1121）→ 保存 `game_state/{channel}.json` L1123-1125 → 删除暂存 L1132-1134 → 发 `completed`/`error` L1136-1163。
磁盘代价：已存在文件会整份复制进暂存（峰值约需 2 倍占用），见 L861-882。

### 校验与修复（L1189-1647）
- Phase1 并发检查 L1252-1421：`max_concurrent` 限制 1..32（L1200）；`quick=true` 跳过 MD5（L1346-1347）；MD5 走 `spawn_blocking` + `hg_crypto::verify_md5_with_cancel(..., Some(&DOWNLOAD_CANCELLED))`（L1351-1357）；结果分类 `MISSING`/`SIZE_MISMATCH`/`MD5_MISMATCH` 并入 `repair_list`（L1380-1399）；后台 500ms 进度任务 L1275-1303。
- 取消检查点 L1426-1429、L1597-1600。
- Phase2 并发重下损坏文件 L1455-1595：`{resource_base_url}/{path}` 下载覆盖原路径（L1556-1571），后台 500ms 进度 L1499-1527。
- 输出 L1626-1646：JSON 字符串 `{"ok","failed","repaired","files":[...damaged paths]}`（由前端本地化）；无损坏时返回 `"All files verified OK"`（L1471）。

### 预下载（L1649-1908）
`preload_download` L1652-1887：要求远程包带 preload URL/版本（L1662-1669）→ 拉 preload 清单 L1672 → 建 `{install_path}.staging.preload.{uuid}` L1685 → 并发下载 L1701-1786（失败仅记日志 L1774-1777）→ 并发校验 L1793-1869（失败仅记日志 L1859-1861）→ `save_preload_state(channel, preload_version, true)` L1872 → `completed` L1875-1883。
安装时的复用见 L890-936；目录定位/清理见 L1890-1908。

### 渠道检测与切换（服务内切换：L2432-2756）
- 取消与活跃操作：入口检查 L2440-2442；设 `active_operation = Switching(checking)` L2476-2486；各阶段取消检查点 L2488/2495/2501/2507/2560/2655/2701，取消时回滚并 `reset_switch_cancel()`。
- Phase1 差异计算 L2475-2549：以**清单对清单** diff（非本地磁盘实际状态），MD5 或 size 不同→下载，仅存在于旧清单→待删除；差异为空直接返回 L2546-2549。
- Phase2 下载 L2551-2648：暂存 `{install_dir}/.switch.download`（L2452）；优先复用备份 `.switch/{to_channel}/{path}`（大小+MD5 校验，L2579-2602）；失败清理暂存与已下载文件 L2633-2641。
- Phase3 备份+删除 L2650-2695：旧文件复制到 `.switch/{from_channel}/{path}` 再删除（L2670-2689）；取消时恢复已备份文件 L2655-2668。
- Phase4 应用 L2697-2741：暂存 → 安装目录逐文件 `fs::copy`；取消时删除已复制文件并从备份回滚 L2701-2717。
- Phase5 清理 L2743-2755：删 `.switch.download`、emit `completed`、sleep 1s、清 `active_operation`。
- **真正的渠道特征识别不在本文件**：`launcher_detect_channel` 在 `commands/launcher.rs:463-510`（按 `glextra.dll`+`play_pc_sdk.dll`+`manifest.xml`→google_play；`gfsdk.dll`+`glfoundation.dll`→global；`PCGameSDK.dll`→bilibili；`hgsdk.dll`→official）。

### 游戏进程启动/检测/杀死（不在本文件，位于 `commands/launcher.rs`）
- 启动：`launcher_start_game` `commands/launcher.rs:291-373` —— 先 `taskkill /F /IM Endfield.exe`（:308-310），sleep 500ms，再 `ShellExecuteW`（`SW_SHOWNORMAL`，工作目录 = 安装目录，:331-338）。
- 检测运行：`launcher_check_game_running` `commands/launcher.rs:522-531`（异步、隐藏控制台地运行 `tasklist /FI "IMAGENAME eq Endfield.exe"` 并检查输出；前端每 3 秒轮询）。
- 杀死：`launcher_kill_game` `commands/launcher.rs:534-570`（隐藏控制台运行 `taskkill /T /F /IM` → 失败再按 exe 名 → 再失败 `wmic process where name like '%Endfield%' call terminate`）。
- 可执行文件存在性：`launcher_check_executable` `commands/launcher.rs:514-519`；进程名/可执行名来自 `models/game.rs:99-106`（均为 `Endfield.exe`）。

### 磁盘空间（不在本文件，位于 `commands/launcher.rs`）
- `launcher_get_disk_space` `commands/launcher.rs:394-447`：取路径最近存在的祖先盘符 → Windows 下调 `powershell Get-PSDrive` 解析 `Used|Free` → `{total, free}`；非 Windows 返回 `u64::MAX`。

### 远程版本与 Banner/公告获取（L152-249、L2003-2430）
- 通用 web 批量代理：`{seq, proxy_reqs}` POST `channel.web_api_url()`（L2011-2023、L2170-2182）。
- Banner：`kind=get_banner`，参数 `appcode/language=zh-cn/channel/sub_channel/platform=Windows/source=launcher`（L2084-2094、L2206-2217）。
- 公告：`kind=get_announcement`（L2118-2128、L2218-2229），`get_notice_content` 内容解析兼容多种字段命名与秒/毫秒时间戳（L2265-2339）。
- 背景：`kind=get_main_bg_image`（L2360-2370），按扩展名区分图/视频（L2418-2430）。
- B 服公告改用官服参数（L2200-2204）。

### 进度事件 emit（本文件 L2455-2473；command 层 L74/117/168）
- 服务内 `switch_channel` 的 `emit` 闭包（L2455-2473）每次同时发两条：
  - `launcher://switch-progress` → `SwitchProgress`（字段见上表）
  - `launcher://progress` → `ActiveOperation::Switching(SwitchProgress)`（serde `type="switching"`）
- 安装/校验/预下载不直接 emit，而是把 `Arc<dyn Fn(DownloadProgress)>` 回调交给 command，由 command 发 `launcher-progress` → `DownloadProgress`（`commands/launcher.rs:74`、`:117`、`:168`）。
- 前端监听三处：`src/utils/launcherService.ts:295`（`launcher-progress`）、`:303`（`launcher://progress`）、`:311`（`launcher://switch-progress`）。

## 备注

**HTTP 端点**
- `POST https://launcher.hypergryph.com/api/proxy/batch_proxy`（official/bilibili，`models/game.rs:31-40`）/ `POST https://launcher.gryphline.com/api/proxy/batch_proxy`（global/google_play）—— 版本检查（本文件 L183）。
- `POST https://launcher.hypergryph.com/api/proxy/web/batch_proxy` / `https://launcher.gryphline.com/api/proxy/web/batch_proxy`（`models/game.rs:43-52`）—— 公告/Banner/背景（L2019、L2178）。
- `GET {resource_base_url}/game_files` —— 加密清单（L459；preload 走 `{preload_resource_url}/game_files`，L1672）。
- `GET {resource_base_url}/{manifest.path}` —— 单文件下载（L988 安装、L1556 修复、L1762 预下载、L2604 切服）。
- 请求体外层统一 `{seq, proxy_reqs}`（L161-173、L2011-2014、L2170-2173）；`seq`：国服 `5`、国际服 `3`（`models/game.rs:91-96`）；`appcode`/`launcher_appcode`/`channel`/`sub_channel` 见 `models/game.rs:55-88`。

**本地路径与文件布局**
- 安装目录内容：`{install_path}/Endfield.exe`、`{install_path}/config.ini`（加密，需 `decrypt_file_to_string` 读）、`{install_path}/Endfield_Data/`（L263-264、L324-326、L415）。
- 安装暂存（兄弟目录）：`{install_path}.staging.{uuid}`（L852）。
- 预下载暂存（兄弟目录）：`{install_path}.staging.preload.{uuid}`（L1685），定位靠前缀匹配（L1890-1901）。
- 切服暂存与备份（安装目录**内**）：`{install_path}/.switch.download`（L2452）、`{install_path}/.switch/{from_channel}/...`（备份，L2651）、`{install_path}/.switch/{to_channel}/...`（复用源，L2576）。
- 下载临时文件：`{dest}.download`（L625、L2770），随改名落定。
- 状态目录：`%LOCALAPPDATA%\cn.msk-network.endprotocol\game_state\{channel}.json`（临时写 `.json.tmp` 后 rename）（L1918-1945、L1952-1953、L1970-1998；根目录见 `utils/paths.rs:7`）。
- `cleanup_staging_files` 清理目标：`{install_path}.switch.download`（L41）、父目录 `{stem}.staging.*`/`{stem}.switch.*`/`{stem}.backup.*`（L47-64）、安装目录内 `*.download` 文件（L66-78）。

**emit 事件名与 payload**
- `launcher://switch-progress` → `SwitchProgress`（L2471）。
- `launcher://progress` → `ActiveOperation`（`type="switching"`）（L2472）。
- `launcher-progress` → `DownloadProgress`（由 `commands/launcher.rs:74/117/168` 发出，服务仅提供回调）。

**被哪些 command 调用**（`src-tauri/src/commands/launcher.rs`，均在 `lib.rs:122-147` 注册）
- 调 service 方法：`launcher_check_status`→`check_status`(:28)、`launcher_install_or_update`→`install_or_update`(:49)、`launcher_verify_and_repair`→`verify_and_repair`(:99，默认 `max_concurrent=12`、`quick=false`)、`launcher_get_remote_version`→`get_latest_package`(:145)、`launcher_preload_download`→`preload_download`(:156，默认并发 8)、`launcher_get_payload_state`→`get_payload_state`(:190)、`launcher_get_banners`(:247)、`launcher_get_announcements`(:258)、`launcher_get_notice_content`(:269)、`launcher_get_background_image`(:280)、`launcher_scan_install_dir`→`scan_install_dir`(:451)、`launcher_switch_channel`→`switch_channel`(:574)。
- 调模块级自由函数：`launcher_cancel_download`→`cancel_download`+`cleanup_staging_files`(:201)、`launcher_has_download_cache`→`has_download_cache`(:214)、`launcher_reset_download_cancel`(:222)、`launcher_cancel_switch`(:228)、`launcher_cancel_all`(:234)。
- 不经过本 service 的同名分区 command：`launcher_start_game`(:291)、`launcher_detect_channel`(:463)、`launcher_check_executable`(:514)、`launcher_check_game_running`(:522)、`launcher_kill_game`(:534)、`launcher_get_disk_space`(:394)、`launcher_browse_folder`(:377)、`launcher_decrypt_file`(:241)、`launcher_get_process_read_bytes`(:10)。

**配置键 / 持久化**
- 本文件**不读写** `app_config.json`（未注入 `ConfigService`）；自身持久化只有 `game_state/{channel}.json`（字段见 `PayloadState`）。
- 相关键位在前端 localStorage：`launcher_install_path`、`launcher_channel`、`launcher_verify_threads`（默认 12）、`launcher_cancel_behavior`、`launcher_skip_stop_confirm`（`src/components/game-action-panel.tsx:47-50`、`game-launch-settings.tsx`）。

**备注 · 发现的异常/坏味道**
1. `download_and_verify`(L752) 与 `download_file_with_resume`(L619) 是 `pub` 但全仓无外部调用（`download_and_verify` 仅调用后者，后者也仅被它调用）；实际批量下载走 `download_single_file`(L2763) —— 疑似死公共 API。
2. `download_file_with_resume` 的“MD5 校验”(L724-730) 拿文件自身的 MD5 去和自己比，恒真且结果被忽略（注释已承认拿不到期望值）。
3. 取消清理路径不一致：`cleanup_staging_files` 删的是 `{install_path}.switch.download`（兄弟路径，L41），而 `switch_channel` 实建的是 `{install_dir}/.switch.download`（目录内，L2452）；且 L66-78 只删 `.download` 结尾的**文件**，因此该暂存**目录**不会被清理。
4. `active_operation` 仅由 `switch_channel` 写入/清空（L2476/L2489…L2748），`install_or_update`/`verify_and_repair`/`preload_download` 从不设置 → L787、L1201 的 `has_active_operation` 守卫对它们实际无效，真正的互斥来自 command 层对 `Arc<Mutex<...>>` 的整段 `lock()`；`ActiveOperation::Installing/Verifying/Repairing` 三个变体后端从未构造（仅序列化定义）。
5. doc 注释错位：L2164「获取启动器公告内容（Banner + 公告合并返回）」实际挂在 `batch_proxy_web_raw`(L2165) 上，`get_notice_content`(L2195) 无文档注释。
6. 事件命名两套规范：服务发 `launcher://switch-progress`/`launcher://progress`（带 `://`），command 发 `launcher-progress`（无），前端三处监听都必须兼容（`launcherService.ts:295/303/311`）。
7. `preload_download` 下载失败（L1774-1777）与校验失败（L1859-1861）都只记日志，随后仍执行 `save_preload_state(..., true)`（L1872）→ 可能把未完成/损坏的预下载标记为已完成，后续安装复用时才会暴露（复用有二次 MD5 校验，L903-907，可兜底）。
8. `scan_install_dir` 的 `channel_detected` 只是「exe+Data+config 存在」（L324-327），`detected_channel` 恒回填调用方传入的渠道（L401），并不做渠道识别（真正识别在 `commands/launcher.rs:463`）。
9. `download_single_file` 为每个文件新建一个 `reqwest::Client`（L2793-2797），高并发时重复建连接池；类内已有可复用的 `download_client`。
10. 调试输出混用 `eprintln!`（L2035-2071、L2343、L2374-2413）与 `tracing`，不利于日志聚合。
11. `switch_channel` Phase2 建了 `dl_counter`(L2614) 传入下载函数却从未读取用于 emit，切服下载阶段只有逐文件开始/结束事件，无字节级实时进度。
12. 切服 diff 只比较两份清单（L2514-2538），不检查本地磁盘实际内容：本地已损坏但两版清单 MD5 相同的文件不会被重新下载。
13. `verify_and_repair` Phase2 中单文件修复失败仅记日志（L1577-1580），最终 JSON 的 `failed` 等于「发现的损坏数」而非「修复后仍损坏数」，`repaired` 才反映实际成功数（L1627-1645）。
