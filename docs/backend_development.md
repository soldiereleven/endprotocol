# 后端开发规范与拓展指南

## 1. 目录结构与文件定位
- **命令入口**: `src-tauri/src/commands/` (处理前端 Invoke 请求)
- **业务服务**: `src-tauri/src/services/` (核心逻辑，如 API 交互、数据缓存)
- **数据模型**: `src-tauri/src/models/` (定义 Rust 结构体，用于序列化和状态存储)
- **工具模块**: `src-tauri/src/utils/` (加密算法、HTTP 客户端封装、日志工具)

## 2. 开发规范
- **错误处理**: 统一使用 `src/utils/error.rs` 中定义的 `AppError`。所有 Command 返回类型应为 `Result<T, AppError>`。
- **异步编程**: 所有涉及 I/O 或网络请求的函数必须标记为 `async`，并使用 `tokio` 运行时。
- **状态管理**: 
  - 全局状态通过 Tauri 的 `State` 机制管理（在 `lib.rs` 中初始化）。
  - 敏感信息（如 Token）严禁硬编码，必须通过配置服务或内存安全存储。
- **日志记录**: 使用 `tracing` 宏（`info!`, `error!`, `debug!`）记录关键流程。

## 3. 拓展位置与方法

### 3.1 新增 Tauri Command
1. **定义命令**: 在 `src/commands/` 下新建或扩展现有模块（如 `my_feature.rs`）。
2. **实现逻辑**: 编写 `#[tauri::command]` 标注的异步函数。
3. **注册命令**: 在 `src/lib.rs` 的 `.invoke_handler()` 中调用 `generate_handler!` 注册新命令。
4. **权限配置**: 若涉及敏感操作，需在 `capabilities/default.json` 中声明权限。

### 3.2 新增业务服务
1. **创建服务**: 在 `src/services/` 下新建文件（如 `my_service.rs`）。
2. **实现 Trait/结构体**: 定义服务结构体并实现相关业务逻辑。
3. **集成到 State**: 在 `lib.rs` 中将服务实例添加到 `Builder` 的 `.manage()` 列表中。
4. **依赖注入**: 在 Command 函数中通过 `State<MyService>` 获取服务实例。

### 3.3 新增数据模型
1. **定义结构体**: 在 `src/models/` 下新建文件，使用 `#[derive(Serialize, Deserialize, Clone)]`。
2. **字段映射**: 确保字段名与森空岛 API 返回的 JSON 键名一致（或使用 `#[serde(rename = "...")]`）。

## 4. 拓展流程示例：添加一个新的 API 查询功能
1. **分析 API**: 确定森空岛 API 的 URL、请求方法、签名算法及参数。
2. **更新模型**: 在 `models/` 中定义返回数据的结构体。
3. **实现服务**: 在 `services/skland_service.rs` 中添加请求方法，处理签名和加密。
4. **暴露命令**: 在 `commands/` 中创建一个 Command，调用服务层方法并返回结果。
5. **前端联调**: 更新前端 `utils/` 中的对应服务进行调用测试。

## 5. 核心加密与签名说明
- **设备指纹**: 通过数美接口获取，涉及 RSA 公钥加密和 AES/DES 对称加密。
- **API 签名**: 采用 HMAC-SHA256 算法，密钥由 `x-signature-key` 派生。
- **文件位置**: 所有加密逻辑集中在 `src/utils/encrypt.rs`。
