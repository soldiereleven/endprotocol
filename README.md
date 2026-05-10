# EndProtocol

一款基于 Tauri + React + TypeScript 构建的桌面应用程序，用于管理与 **森空岛 (Skland)** 平台游戏账户。

## 简介

EndProtocol 是一款跨平台桌面客户端，为游戏玩家提供便捷的账户管理和角色信息查看功能。该应用通过调用森空岛 API 实现账户登录、数据同步和角色信息展示，支持《终末地》等游戏的账户管理需求。

## 功能特性

### 核心功能

- **账户管理**：支持添加、删除、批量操作游戏账户
- **多种登录方式**：
  - 手机号 + 密码登录
  - 验证码登录
- **角色信息展示**：显示游戏角色头像、昵称、等级、服务器等详细信息
- **自动同步**：定时自动刷新账户状态和角色数据
- **头像缓存**：本地缓存玩家头像，提升加载速度

### UI/UX 特性

- **多语言支持**：支持简体中文和英文
- **主题切换**：支持浅色、深色模式，可跟随系统设置
- **自定义标题栏**：无边框窗口设计，自定义最小化、最大化、关闭按钮
- **响应式布局**：适配不同屏幕尺寸

## 技术栈

### 前端

| 技术         | 版本  | 用途      |
| ------------ | ----- | --------- |
| React        | 19.x  | UI 框架   |
| TypeScript   | 5.6.x | 类型系统  |
| Vite         | 6.x   | 构建工具  |
| Tailwind CSS | 4.x   | 样式框架  |
| HeroUI       | 3.0.x | UI 组件库 |
| React Router | 6.x   | 路由管理  |
| i18next      | 26.x  | 国际化    |

### 后端

| 技术    | 版本 | 用途            |
| ------- | ---- | --------------- |
| Tauri   | 2.x  | 桌面应用框架    |
| Rust    | 2021 | 后端核心语言    |
| reqwest | 0.12 | HTTP 客户端     |
| tokio   | 1.x  | 异步运行时      |
| serde   | 1.x  | 序列化/反序列化 |

### 加密相关

- **RSA**: 设备指纹加密
- **AES/DES**: 数据加密
- **HMAC-SHA256**: 签名验证
- **Gzip**: 数据压缩

## 项目结构

```
endprotocol/
├── src/                          # React 前端源码
│   ├── components/              # UI 组件
│   │   ├── account-switch-modal.tsx
│   │   ├── custom-modal.tsx
│   │   ├── custom-titlebar.tsx   # 自定义标题栏
│   │   ├── dashboard-sidebar.tsx
│   │   ├── language-switch.tsx
│   │   ├── navbar.tsx
│   │   ├── role-select-modal.tsx
│   │   ├── simple-pagination.tsx
│   │   └── theme-switch.tsx
│   ├── layouts/                  # 页面布局
│   │   ├── dashboard.tsx
│   │   └── default.tsx
│   ├── locales/                  # 国际化翻译文件
│   │   ├── en/translation.json
│   │   └── zh/translation.json
│   ├── pages/                    # 页面组件
│   │   ├── account.tsx           # 账户管理页面
│   │   ├── dashboard.tsx         # 仪表板页面
│   │   └── settings.tsx          # 设置页面
│   ├── config/                   # 配置文件
│   │   └── site.ts
│   ├── types/                   # TypeScript 类型定义
│   ├── utils/                   # 工具函数
│   ├── App.tsx                  # 主应用组件
│   ├── main.tsx                 # 入口文件
│   ├── provider.tsx             # React Context 提供者
│   └── i18n.ts                  # i18n 初始化
├── src-tauri/                   # Tauri/Rust 后端
│   ├── src/
│   │   ├── commands/           # Tauri 命令（API 处理器）
│   │   │   ├── account.rs
│   │   │   ├── config.rs
│   │   │   ├── mod.rs
│   │   │   └── window.rs
│   │   ├── models/             # 数据模型
│   │   │   ├── account.rs
│   │   │   ├── login.rs
│   │   │   ├── role.rs
│   │   │   └── mod.rs
│   │   ├── services/           # 业务逻辑服务
│   │   │   ├── account_service.rs
│   │   │   ├── avatar_cache_service.rs
│   │   │   ├── config_service.rs
│   │   │   ├── skland_service.rs
│   │   │   └── mod.rs
│   │   ├── utils/              # 工具模块
│   │   │   ├── encrypt.rs      # 加密工具
│   │   │   ├── error.rs        # 错误处理
│   │   │   ├── http_client.rs  # HTTP 客户端
│   │   │   ├── logger.rs       # 日志系统
│   │   │   └── mod.rs
│   │   ├── lib.rs              # Tauri 应用入口
│   │   └── main.rs             # Rust 主函数
│   ├── capabilities/            # Tauri 权限配置
│   ├── icons/                  # 应用图标
│   ├── tauri.conf.json         # Tauri 配置
│   └── Cargo.toml              # Rust 依赖
├── public/                     # 静态资源
├── package.json                # Node.js 依赖
├── vite.config.ts             # Vite 配置
├── tsconfig.json              # TypeScript 配置
└── LOGGING_SYSTEM.md         # 日志系统文档
```

## 安装指南

### 环境要求

- **Node.js**: 18.x 或更高版本
- **pnpm**: 推荐使用 pnpm 作为包管理器
- **Rust**: 最新稳定版
- **Tauri CLI**: v2.x

### 安装步骤

1. **克隆项目**

```bash
git clone <repository-url>
cd endprotocol
```

2. **安装前端依赖**

```bash
pnpm install
```

3. **安装 Rust 依赖**

```bash
cd src-tauri
cargo build
cd ..
```

### 运行项目

#### 开发模式

```bash
# 启动前端开发服务器和 Tauri 应用
pnpm tauri dev
```

#### 构建发布

```bash
# 构建生产版本
pnpm tauri build
```

构建产物位于 `src-tauri/target/release/` 目录下（Windows 为 `.exe` 文件）。

## 使用方法

### 账户登录

1. 点击侧边栏「账户」进入账户管理页面
2. 点击「添加账户」按钮
3. 选择登录方式（手机号登录或验证码登录）
4. 输入账户信息并完成验证
5. 登录成功后，账户将显示在列表中

### 账户管理

- **刷新数据**：点击「刷新数据」按钮更新账户状态
- **查看详情**：点击账户卡片查看详细信息
- **批量操作**：勾选多个账户进行批量登出

### 设置

- **语言切换**：在设置中选择简体中文或 English
- **主题切换**：选择浅色、深色或跟随系统

## 架构说明

### 前后端通信

应用采用 Tauri 的命令系统实现前后端通信：

```
┌─────────────────────┐
│    React Frontend   │
│   (invoke 调用)     │
└─────────┬───────────┘
          │ Tauri invoke()
          ▼
┌─────────────────────┐
│   Tauri Commands    │
│   (commands/*)      │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│   Service Layer     │
│  (account_service)  │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Skland API         │
│  (第三方服务)        │
└─────────────────────┘
```

### 主要服务

| 服务                 | 功能                         |
| -------------------- | ---------------------------- |
| `AccountService`     | 账户操作（登录、登出、刷新） |
| `SklandService`      | 森空岛 API 调用和加密处理    |
| `ConfigService`      | 配置持久化存储               |
| `AvatarCacheService` | 头像本地缓存                 |

## 配置说明

### Tauri 配置

应用窗口配置位于 `src-tauri/tauri.conf.json`：

- **窗口尺寸**: 1200 x 700 像素
- **可调整大小**: 是
- **窗口装饰**: 无（使用自定义标题栏）
- **启动时居中**: 是

### 应用配置

应用配置存储在用户数据目录：

- **Windows**: `%APPDATA%\cn.msk-network.endprotocol\`
- **macOS**: `~/Library/Application Support/cn.msk-network.endprotocol/`
- **Linux**: `~/.config/cn.msk-network.endprotocol/`

## 开发相关

### 推荐 IDE

- **VS Code** + 扩展:
  - [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
  - [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
  - [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
  - [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

### 日志系统

应用使用统一日志系统，记录文件位于：

- **Windows**: `%LOCALAPPDATA%\cn.msk-network.endprotocol\logs\`

详细日志配置请参阅 [LOGGING_SYSTEM.md](./LOGGING_SYSTEM.md)。

## 许可证

Copyright (C) 2026 MSK Network

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, version 3.

## 为什么使用AGPL v3.0 而不是 MIT

本项目采用了 GNU Affero General Public License（AGPL），而不是更常见的 MIT License。这里简单说明一下原因。

我们选择 AGPL，并不是为了限制使用，而是为了确保项目在被使用和改进的过程中，依然能够对整个社区保持开放和可持续。

在一些场景下，如果使用像 MIT 这样非常宽松的许可证，项目可能会被集成到闭源系统中进行扩展，而这些改进不会回馈社区。长期来看，这会削弱开源项目本身的演进能力。

AGPL 的设计初衷是解决这个问题：

- 如果你修改了本项目并对外提供服务，需要公开这些修改
- 如果你基于本项目构建并分发软件，需要遵循相同的开源规则

这意味着所有改进都有机会回到社区，而不是被封闭在某个私有系统中。

同时，我们仍然希望这个项目是可用、可学习、可扩展的：

- 你可以自由地使用、研究和修改代码
- 你可以在个人项目或开源项目中使用它
- 我们不会对正常的开发和学习场景设置额外障碍

我们理解不同项目对许可证的需求不同。如果你的使用场景与 AGPL 不兼容，也欢迎与我们联系讨论其他授权方式。
