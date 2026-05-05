# 日志系统优化说明

## 概述

本项目已实现统一的日志系统，简化了终端输出，增加了文件输出功能，并添加了时间戳等元数据信息。

### 最新优化 (2026-05-04)

✅ **已完成**：

- 替换所有 `println!` 调用为统一的日志宏（除测试代码外）
- 优化日志格式，去除冗余的 `[DEBUG]` 前缀
- 精简调试日志输出，保留关键信息
- 统一日志格式为：`[时间戳] [级别] 消息`

## 主要改进

### 1. Rust 后端日志系统

#### 特性

- **统一日志API**: 使用 `log_debug!`, `log_info!`, `log_warn!`, `log_error!` 宏
- **自动时间戳**: 每条日志都包含精确到毫秒的时间戳
- **日志级别**: 支持 DEBUG, INFO, WARN, ERROR 四个级别
- **彩色终端输出**: 不同级别的日志在终端中以不同颜色显示
- **文件持久化**: 日志自动保存到文件，按日期分割
- **结构化格式**: `[时间戳] [级别] 消息` 的统一格式

#### 文件位置

- 日志工具: `src-tauri/src/utils/logger.rs`
- 日志目录: `%LOCALAPPDATA%\EndProtocol\logs\app-YYYY-MM-DD.log` (Windows)

#### 使用方法

```rust
use crate::{log_debug, log_info, log_warn, log_error};

// 调试日志
log_debug!("用户ID: {}, 操作: {}", user_id, operation);

// 信息日志
log_info!("账户登录成功: {}", username);

// 警告日志
log_warn!("Token即将过期，剩余时间: {}秒", remaining_time);

// 错误日志
log_error!("数据库连接失败: {}", error_message);
```

### 2. TypeScript 前端日志系统

#### 特性

- **统一日志API**: 使用 `logDebug`, `logInfo`, `logWarn`, `logError` 函数
- **自动时间戳**: ISO 8601 格式的时间戳
- **日志级别**: 支持 DEBUG, INFO, WARN, ERROR 四个级别
- **控制台输出**: 根据级别使用不同的 console 方法
- **本地存储**: 日志保存到 localStorage，便于调试
- **可配置**: 可以动态调整日志级别和输出方式

#### 文件位置

- 日志工具: `src/utils/logger.ts`
- 存储键: `app_logs`

#### 使用方法

```typescript
import { logDebug, logInfo, logWarn, logError } from "./utils/logger";

// 调试日志
logDebug("组件挂载", { componentName: "AccountPage" });

// 信息日志
logInfo("用户切换账户", { accountId: "12345" });

// 警告日志
logWarn("API响应缓慢", { responseTime: 5000 });

// 错误日志
logError("网络请求失败", { url: "/api/accounts", error: err });
```

## 配置选项

### Rust 后端配置

在 `src-tauri/src/utils/logger.rs` 中可以修改 `LoggerConfig`:

```rust
pub struct LoggerConfig {
    pub log_to_console: bool,      // 是否输出到控制台
    pub log_to_file: bool,         // 是否保存到文件
    pub log_level: LogLevel,       // 最小日志级别
    pub log_dir: PathBuf,          // 日志目录
}
```

### TypeScript 前端配置

在 `src/utils/logger.ts` 中可以修改配置:

```typescript
const DEFAULT_CONFIG: LoggerConfig = {
  enableConsole: true, // 是否输出到控制台
  enableLocalStorage: true, // 是否保存到localStorage
  minLevel: LogLevel.INFO, // 最小日志级别
  maxStorageSize: 1000, // 最大保存的日志条数
};
```

## 日志级别说明

| 级别  | 用途           | 颜色 (终端) | 默认启用 |
| ----- | -------------- | ----------- | -------- |
| DEBUG | 详细的调试信息 | 青色        | 否       |
| INFO  | 一般信息性消息 | 绿色        | 是       |
| WARN  | 警告信息       | 黄色        | 是       |
| ERROR | 错误信息       | 红色        | 是       |

## 迁移指南

### Rust 代码迁移

将原有的 `println!` 调用替换为新的日志宏：

**之前:**

```rust
println!("[DEBUG] 处理用户请求: {}", user_id);
println!("[ERROR] 操作失败: {}", error);
```

**之后:**

```rust
log_debug!("处理用户请求: {}", user_id);
log_error!("操作失败: {}", error);
```

### TypeScript 代码迁移

将原有的 `console.log/error/warn` 调用替换为新的日志函数：

**之前:**

```typescript
console.log("账户加载成功", accounts);
console.error("加载失败", error);
```

**之后:**

```typescript
logInfo("账户加载成功", accounts);
logError("加载失败", error);
```

## 优势

1. **简化终端输出**: 去除了冗长的 `[DEBUG]` 前缀，使用统一的格式化输出
2. **时间戳追踪**: 每条日志都有精确的时间戳，便于问题定位
3. **持久化存储**: 日志保存到文件/localStorage，刷新后仍可查看
4. **分级管理**: 可以根据需要调整日志级别，生产环境可以减少调试日志
5. **彩色输出**: 终端中不同级别的日志以不同颜色显示，易于区分
6. **结构化数据**: 支持附加数据结构，便于后续分析
7. **全面覆盖**: 已替换所有 `println!` 调用（除测试代码外），确保日志一致性
8. **精简格式**: 优化后的日志格式更简洁，关键信息一目了然

## 注意事项

1. **性能考虑**: 在生产环境中，建议将日志级别设置为 INFO 或更高，以减少 DEBUG 日志的输出
2. **存储空间**: 前端日志存储在 localStorage 中，有大小限制（通常5-10MB），已实现自动清理机制
3. **文件轮转**: 后端日志按日期分割，建议定期清理旧日志文件
4. **敏感信息**: 避免在日志中记录敏感信息（如密码、token等）

## 示例输出

### 优化前（旧格式）

```
[DEBUG] check_and_refresh_user_cred: Cred EXPIRED for user 12345, attempting refresh...
[ERROR] check_and_refresh_user_cred: hytoken NOT FOUND for user 12345, cannot refresh
[DEBUG] get_accounts: START
[DEBUG] get_accounts: found 3 roles to fetch
```

### 优化后（新格式）

**终端输出：**

```
[2026-05-04 15:20:30.123] [INFO] Logger initialized successfully
[2026-05-04 15:20:31.456] [DEBUG] get_accounts: START
[2026-05-04 15:20:31.789] [INFO] check_and_refresh_user_cred: Cred EXPIRED for user 12345, attempting refresh...
[2026-05-04 15:20:32.012] [ERROR] Failed to refresh cred for user 12345: Network timeout
[2026-05-04 15:20:32.345] [DEBUG] DES Encrypt - Field: smid, Key: abc123, ObfName: x1y2z3
```

**日志文件内容：**

```
[2026-05-04 15:20:30.123] [INFO] Logger initialized successfully
[2026-05-04 15:20:31.456] [DEBUG] get_accounts: START
[2026-05-04 15:20:31.789] [INFO] check_and_refresh_user_cred: Cred EXPIRED for user 12345, attempting refresh...
[2026-05-04 15:20:32.012] [ERROR] Failed to refresh cred for user 12345: Network timeout
[2026-05-04 15:20:32.345] [DEBUG] DES Encrypt - Field: smid, Key: abc123, ObfName: x1y2z3
```

## 故障排除

### 日志没有输出到文件

1. 检查日志目录是否有写入权限
2. 确认 `log_to_file` 配置为 `true`
3. 查看控制台是否有初始化错误

### 前端日志丢失

1. 检查 localStorage 是否被清除
2. 确认 `enableLocalStorage` 配置为 `true`
3. 检查是否超过 `maxStorageSize` 限制

### 编译警告

如果出现未使用的导入警告，可以移除未使用的日志级别导入：

```typescript
// 如果只使用 logError，可以这样导入
import { logError } from "./utils/logger";
```
