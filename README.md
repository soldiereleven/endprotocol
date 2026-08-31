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
  - 二维码扫码登录（森空岛/鹰通行证）
- **角色信息展示**：显示游戏角色头像、昵称、等级、服务器等详细信息，支持技能、天赋、装备、Wiki 数据查看
- **抽卡记录**：完整抽卡历史，含保底追踪、卡池筛选（限定/联合/标准/武器），ECharts 保底图表与统计
- **每日签到**：查看并执行每日签到
- **勋章浏览**：浏览已收集的成就勋章，支持 aura-glass 特效
- **自动同步**：定时自动刷新账户状态和角色数据
- **头像缓存**：本地缓存玩家头像，提升加载速度

### 仪表板

- **可定制卡片系统**：拖拽式卡片布局，支持标签页管理，可添加/移除/排序卡片
- **多种卡片类型**：
  - `character-list` — 角色列表（单列/双列/三列模式）
  - `account-info` — 账户概览
  - `account-progress` — 进度追踪
  - `attendance` — 每日签到
  - `achievement` — 成就勋章展示
  - `spaceship` — 飞船/角色选择
  - `domain-info` — 领域信息
- **卡片开发模板**：提供 `_template` 模板，支持自定义卡片开发与本地化

### 更新系统

- **双更新通道**：稳定版 (Stable) 与预览版 (Preview)
- **双更新源**：GitHub Releases 与 Cloudflare R2 镜像
- **应用内更新**：Tauri updater 插件 + minisign 签名验证，支持下载进度、更新日志、取消操作
- **启动自动检查**：启动 3 秒后自动检查更新

### 消息通知系统

- **通知铃铛**：右上角铃铛图标，滑出式消息抽屉
- **事件驱动**：登录、登出、抽卡同步、签到等操作自动推送通知
- **持久化存储**：基于 sessionStorage 的消息持久化

### 开发者工具

- **日志查看器**：前端 + 后端日志，支持按级别筛选
- **Wiki 数据调试**：Wiki 数据转储与调试
- **缓存管理**：智能缓存（固定/活跃/非活跃状态）与手动清理

### UI/UX 特性

- **毛玻璃设计**：基于 aura-glass 组件库的液态玻璃效果（GlassCard、GlassButton、GlassSwitch、GlassModal 等 20+ 组件）
- **多语言支持**：支持简体中文和英文
- **主题切换**：支持浅色、深色模式，可跟随系统设置
- **强调色系统**：6 种预设强调色（indigo、blue、emerald、rose、amber、slate）+ 自定义颜色选择器
- **自定义标题栏**：无边框窗口设计，自定义最小化、最大化、关闭按钮
- **自定义背景图片**：用户可设置背景图片并调节透明度
- **亚克力窗口效果**：Windows 亚克力背景，支持透明度配置
- **响应式布局**：桌面端侧边栏 + 移动端抽屉菜单
- **路由持久化**：记住上次访问的路由
- **交互效果**：组件悬停/点击动画效果

## 技术栈

### 前端

| 技术              | 版本   | 用途               |
| ----------------- | ------ | ------------------ |
| React             | 19.x   | UI 框架            |
| TypeScript        | 5.6.x  | 类型系统           |
| Vite              | 6.x    | 构建工具           |
| Tailwind CSS      | 4.x    | 样式框架           |
| aura-glass        | 3.5.x  | 毛玻璃 UI 组件库   |
| React Router      | 6.x    | 路由管理           |
| i18next           | 26.x   | 国际化             |
| ECharts           | 6.x    | 图表（保底统计）   |
| dnd-kit           | 6.x    | 拖拽排序（卡片）   |
| Lucide            | 1.33.x | 图标库             |
| morphicons        | 1.7.x  | 变形图标           |
| qrcode            | 1.5.x  | 二维码生成（扫码登录）|
| react-beautiful-color | 2.1.x | 颜色选择器     |
| clsx / tailwind-variants | 2.1.x / 3.2.x | 类名工具 |
| uuid              | 14.x   | UUID 生成          |

### 后端

| 技术        | 版本  | 用途              |
| ----------- | ----- | ----------------- |
| Tauri       | 2.x   | 桌面应用框架      |
| Rust        | 2021  | 后端核心语言      |
| reqwest     | 0.12  | HTTP 客户端       |
| tokio       | 1.x   | 异步运行时        |
| serde       | 1.x   | 序列化/反序列化   |
| windows-sys | 0.61  | Windows API（GDI 截屏）|

### Tauri 插件

- **tauri-plugin-opener**：URL/文件打开
- **tauri-plugin-process**：进程管理（退出应用）
- **tauri-plugin-updater**：应用内自动更新（minisign 验证）
- **tauri-plugin-fs**：文件系统访问

### 加密相关

- **RSA**：设备指纹加密
- **AES/DES (CBC/ECB)**：数据加密
- **HMAC-SHA256**：签名验证
- **MD5**：哈希计算
- **Gzip (flate2)**：数据压缩
- **Base64**：编码转换

## 项目结构

```
endprotocol/
├── src/                              # React 前端源码
│   ├── pages/                        # 页面组件
│   │   ├── dashboard.tsx             # 仪表板（可定制卡片网格）
│   │   ├── account.tsx               # 账户管理
│   │   ├── characters.tsx            # 角色浏览
│   │   ├── char-select.tsx           # 角色选择
│   │   ├── gacha-records.tsx         # 抽卡记录
│   │   ├── attendance.tsx            # 每日签到
│   │   ├── medals.tsx                # 成就勋章
│   │   ├── settings.tsx              # 设置
│   │   └── developer.tsx             # 开发者工具
│   ├── components/                   # UI 组件
│   │   ├── cards/                    # 仪表板卡片系统
│   │   │   ├── registry/             # 卡片注册中心
│   │   │   ├── base/                 # 基础卡片组件
│   │   │   ├── character-list/       # 角色列表卡片
│   │   │   ├── account-info/         # 账户信息卡片
│   │   │   ├── account-progress/     # 进度追踪卡片
│   │   │   ├── attendance/           # 签到卡片
│   │   │   ├── achievement/          # 成就勋章卡片
│   │   │   ├── spaceship/            # 飞船卡片
│   │   │   ├── domain-info/          # 领域信息卡片
│   │   │   ├── _template/            # 卡片开发模板
│   │   │   ├── card-container.tsx    # 卡片容器
│   │   │   └── card-context-menu.tsx # 卡片右键菜单
│   │   ├── ui/                       # 基础 UI 组件
│   │   ├── custom-titlebar.tsx       # 自定义标题栏
│   │   ├── dashboard-sidebar.tsx     # 侧边栏
│   │   ├── update-dialog.tsx         # 更新对话框
│   │   ├── message-card.tsx          # 消息卡片
│   │   ├── gacha-pity-chart.tsx      # 保底图表
│   │   ├── gacha-stat-charts.tsx     # 抽卡统计图表
│   │   └── ...
│   ├── cards/                        # 卡片启动服务
│   │   └── startup-service.ts
│   ├── layouts/                      # 页面布局
│   ├── hooks/                        # 自定义 Hooks
│   ├── locales/                      # 国际化翻译文件
│   │   ├── en/translation.json
│   │   └── zh/translation.json
│   ├── config/                       # 配置文件
│   ├── types/                        # TypeScript 类型定义
│   ├── utils/                        # 工具函数
│   ├── lib/                          # 库函数
│   ├── styles/                       # 全局样式
│   ├── App.tsx                       # 主应用组件
│   ├── main.tsx                      # 入口文件
│   ├── provider.tsx                  # React Context 提供者
│   └── i18n.ts                       # i18n 初始化
├── src-tauri/                        # Tauri/Rust 后端
│   ├── src/
│   │   ├── commands/                 # Tauri 命令（12 个模块）
│   │   │   ├── account.rs            # 账户 CRUD、登录（密码/短信/扫码）
│   │   │   ├── attendance.rs         # 签到操作
│   │   │   ├── gacha.rs              # 抽卡记录同步与统计
│   │   │   ├── card_config.rs        # 卡片配置持久化
│   │   │   ├── config.rs             # 通用配置读写
│   │   │   ├── image.rs              # 图片下载、缓存、背景图管理
│   │   │   ├── window.rs             # 窗口控制
│   │   │   ├── color_picker.rs       # 屏幕取色
│   │   │   ├── logs.rs               # 后端日志获取
│   │   │   ├── updater.rs            # 更新下载与安装
│   │   │   └── wiki_debug.rs         # Wiki 调试数据
│   │   ├── services/                 # 业务逻辑服务（10 个模块）
│   │   │   ├── account_service.rs    # 账户操作与缓存
│   │   │   ├── skland_service.rs     # 森空岛 API 调用与加密
│   │   │   ├── config_service.rs     # JSON 配置持久化
│   │   │   ├── avatar_cache_service.rs # 头像本地缓存
│   │   │   ├── gacha_service.rs      # 抽卡记录管理
│   │   │   ├── network_service.rs    # 网络数据获取
│   │   │   ├── char_detail_service.rs    # 角色详情 API
│   │   │   ├── char_wiki_detail_service.rs # Wiki 详情 API
│   │   │   └── data_query.rs         # 数据查询工具
│   │   ├── models/                   # 数据模型
│   │   ├── utils/                    # 工具模块
│   │   │   ├── encrypt.rs            # 加密工具（RSA/AES/DES/HMAC/MD5/Gzip）
│   │   │   ├── error.rs              # 错误处理
│   │   │   ├── http_client.rs        # HTTP 客户端配置
│   │   │   ├── logger.rs             # 日志系统（tracing）
│   │   │   └── paths.rs              # 应用目录路径
│   │   ├── lib.rs                    # Tauri 应用入口
│   │   └── main.rs                   # Rust 主函数
│   ├── capabilities/                 # Tauri 权限配置
│   ├── icons/                        # 应用图标
│   ├── tauri.conf.json               # Tauri 配置
│   └── Cargo.toml                    # Rust 依赖
├── .github/workflows/               # GitHub Actions CI/CD
│   └── release.yml                   # 自动构建与发布
├── public/                           # 静态资源
├── package.json                      # Node.js 依赖
├── vite.config.ts                    # Vite 配置
├── tsconfig.json                     # TypeScript 配置
└── LOGGING_SYSTEM.md                 # 日志系统文档
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
3. 选择登录方式：
   - **手机号登录**：输入手机号和密码
   - **验证码登录**：输入手机号获取验证码
   - **扫码登录**：使用森空岛/鹰通行证 App 扫描二维码
4. 输入账户信息并完成验证
5. 登录成功后，账户将显示在列表中

### 仪表板

- 仪表板支持可定制的卡片布局
- 点击「添加卡片」按钮选择并添加新卡片
- 拖拽卡片可调整位置和顺序
- 右键卡片可进行编辑、删除等操作
- 支持标签页管理，可创建多个标签页组织卡片

### 账户管理

- **刷新数据**：点击「刷新数据」按钮更新账户状态
- **查看详情**：点击账户卡片查看详细信息
- **批量操作**：勾选多个账户进行批量登出
- **角色选择**：切换查看不同角色的数据

### 设置

- **语言切换**：在设置中选择简体中文或 English
- **主题切换**：选择浅色、深色或跟随系统
- **强调色**：选择预设颜色或自定义颜色
- **背景图片**：设置自定义背景图片并调节透明度
- **更新通道**：切换稳定版/预览版更新通道
- **更新源**：切换 GitHub/镜像更新源
- **开发者模式**：启用后可访问日志查看器、Wiki 调试等工具

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
│   (12 个命令模块)   │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│   Service Layer     │
│  (10 个服务模块)    │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Skland API         │
│  (第三方服务)        │
└─────────────────────┘
```

### 主要服务

| 服务                      | 功能                                |
| ------------------------- | ----------------------------------- |
| `AccountService`          | 账户操作（登录、登出、刷新、缓存）  |
| `SklandService`           | 森空岛 API 调用和加密处理           |
| `ConfigService`           | JSON 配置持久化存储                 |
| `AvatarCacheService`      | 头像本地缓存                        |
| `GachaService`            | 抽卡记录管理                        |
| `NetworkService`          | 网络数据获取                        |
| `CharDetailService`       | 角色详情 API 调用                   |
| `CharWikiDetailService`   | Wiki 详情 API 调用                  |
| `DataQuery`               | 数据查询工具                        |

### 数据流

1. 前端通过 `invoke()` 调用 Tauri 命令
2. Tauri 命令委托给对应的服务模块
3. 服务调用森空岛 API（通过 SklandService 进行加密/签名）
4. 响应数据缓存到本地（ConfigService）并返回前端
5. 前端响应式更新 UI

### 卡片系统

仪表板采用模块化卡片架构：

```
src/components/cards/
├── registry/              # 卡片注册中心
│   ├── types.ts           # 卡片类型定义
│   └── registry.ts        # 卡片注册与发现
├── base/                  # 基础卡片组件
├── character-list/        # 角色列表卡片
├── account-info/          # 账户信息卡片
├── account-progress/      # 进度追踪卡片
├── attendance/            # 签到卡片
├── achievement/           # 成就勋章卡片
├── spaceship/             # 飞船卡片
├── domain-info/           # 领域信息卡片
├── _template/             # 卡片开发模板
├── card-container.tsx     # 卡片容器（拖拽、尺寸调整）
└── card-context-menu.tsx  # 卡片右键菜单
```

每种卡片类型包含：
- `*.meta.json`：卡片元数据（ID、名称、描述、图标、默认尺寸）
- `index.tsx`：卡片组件实现
- `locales/`：卡片本地化翻译文件（可选）

## 配置说明

### Tauri 配置

应用窗口配置位于 `src-tauri/tauri.conf.json`：

- **窗口尺寸**: 1200 x 700 像素
- **可调整大小**: 是
- **窗口装饰**: 无（使用自定义标题栏）
- **启动时居中**: 是
- **窗口效果**: Windows 亚克力背景（透明度可配置）
- **打包格式**: NSIS 安装程序（支持更新产物）

### 应用配置

应用配置存储在用户数据目录：

- **Windows**: `%APPDATA%\cn.msk-network.endprotocol\`
- **macOS**: `~/Library/Application Support/cn.msk-network.endprotocol/`
- **Linux**: `~/.config/cn.msk-network.endprotocol/`

### 更新系统

应用支持应用内自动更新：

| 通道     | 版本格式              | 说明               |
| -------- | --------------------- | ------------------ |
| Stable   | `x.y.z`               | 正式发布版本       |
| Preview  | `x.y.z-preview.suffix` | 预览版/测试版      |

| 更新源     | 端点                                              |
| ---------- | ------------------------------------------------- |
| GitHub     | `github.com/soldiereleven/endprotocol/releases`   |
| 镜像       | `updates.msk-network.cn` (Cloudflare R2 同步)     |

更新流程使用 Tauri updater 插件 + minisign 签名验证，确保更新安全可靠。

## CI/CD

项目使用 GitHub Actions 实现自动化构建与发布：

- **触发条件**: 推送 `v*` 标签时触发
- **构建目标**: Windows x64 (`x86_64-pc-windows-msvc`)
- **构建流程**:
  1. 从 Git 标签同步版本号
  2. 安装 pnpm + Node.js 24 + Rust stable
  3. 生成更新日志（基于 conventional commits）
  4. Tauri 构建（含 updater 产物）
  5. 创建 GitHub Release（含 minisign 签名的 updater JSON）

### 版本号约定

- **正式版**: 遵循语义化版本 `x.y.z`
- **预览版**: 语义化版本 + 后缀 `x.y.z-preview`

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

### 开发者模式

在设置中启用「开发者模式」后，可访问：

- **日志查看器**：查看前端和后端日志，支持按级别筛选
- **Wiki 数据调试**：转储 Wiki 数据用于调试
- **缓存管理**：管理图片缓存（智能/手动模式）
- **用户信息调试**：转储用户信息数据

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
