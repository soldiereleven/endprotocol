# API 通信与数据流规范

## 1. 通信机制
前端与后端通过 Tauri 的 IPC (Inter-Process Communication) 进行通信。
- **前端调用**: `import { invoke } from '@tauri-apps/api/core';`
- **后端响应**: 所有 Command 必须返回 `Result<T, AppError>`，确保错误能被前端正确捕获。

## 2. 命名规范
- **Command 命名**: 采用 `snake_case`，并以动词开头（如 `get_account_list`, `login_with_password`）。
- **模块划分**: 
  - `account.rs`: 账户登录、登出、列表管理。
  - `config.rs`: 全局配置读写。
  - `window.rs`: 窗口控制（最大化、最小化等）。

## 3. 数据流说明

### 3.1 账户登录流程
1. **前端**: 收集手机号/密码 -> 调用 `login_with_password`。
2. **后端**: 
   - 生成设备指纹 (`generate_device_fp`)。
   - 发送验证码 -> 提交登录请求。
   - 获取 `token` 和 `cred` -> 存入 `AccountService` 状态。
3. **持久化**: 登录成功后，自动调用配置服务保存账户信息到本地。

### 3.2 角色数据懒加载流程
1. **前端**: 用户点击某个角色卡片。
2. **检查缓存**: 前端检查本地状态是否已有该角色详情。
3. **后端请求**: 若无缓存，调用 `get_char_detail`。
4. **API 交互**: 后端通过 `SklandService` 向森空岛发起请求，处理签名与解密。
5. **数据返回**: 后端返回解析后的 JSON 数据，前端更新 UI 并缓存。

### 3.3 仪表板配置同步
1. **前端**: 拖拽卡片结束 -> 触发 `onDragEnd`。
2. **状态更新**: 更新 React 内部的卡片位置状态。
3. **持久化**: 调用 `save_dashboard_config` 将最新布局写入本地 JSON 文件。

## 4. 错误处理规范
- **统一错误码**: 后端定义标准错误类型（如 `NetworkError`, `AuthError`, `ParseError`）。
- **前端反馈**: 捕获错误后，通过 UI 组件（如 Toast 或 Modal）向用户展示友好的错误提示。
- **日志追踪**: 任何异常必须在后端通过 `tracing::error!` 记录详细堆栈信息。

## 5. 安全性要求
- **敏感数据**: 严禁在日志中打印明文密码或完整的 Token。
- **输入校验**: 后端必须对所有传入参数进行合法性校验。
- **权限控制**: 涉及系统级操作（如文件读写）需在 `tauri.conf.json` 和 `capabilities` 中严格限制。
