# 项目结构与运行流程说明

## 1. 项目概述
EndProtocol 是一个基于 Tauri 2.x 和 React 19 构建的桌面应用程序，主要用于集成森空岛（Skland）API，提供多账户管理、角色数据查询与展示功能。

## 2. 技术栈
- **前端**: React 19, TypeScript, Vite, Tailwind CSS, HeroUI, i18next, @dnd-kit/core
- **后端**: Tauri 2.x, Rust, reqwest, tokio, serde, crypto (aes, rsa, hmac-sha256)
- **通信**: Tauri Invoke (IPC)

## 3. 目录结构
```
EndProtocol/
├── docs/                  # 项目开发文档集中存储目录
├── src/                   # 前端源码
│   ├── components/        # UI 组件
│   │   ├── cards/         # 仪表板卡片组件
│   │   └── ...            # 其他通用组件
│   ├── pages/             # 页面路由组件
│   ├── utils/             # 前端工具类与服务
│   ├── types/             # TypeScript 类型定义
│   ├── locales/           # 国际化资源文件
│   └── ...
├── src-tauri/             # 后端源码
│   ├── src/
│   │   ├── commands/      # Tauri 命令入口
│   │   ├── services/      # 核心业务逻辑服务
│   │   ├── models/        # 数据模型定义
│   │   └── utils/         # 加密、网络等底层工具
│   └── ...
└── ...
```

## 4. 项目运行流程
1. **启动阶段**: 
   - `main.rs` 启动 Tauri 应用。
   - `lib.rs` 初始化日志、配置服务、Skland 服务及账户服务。
2. **前端加载**: 
   - `App.tsx` 挂载路由，根据用户登录状态跳转至仪表板或账户页。
3. **数据交互**: 
   - 前端通过 `@tauri-apps/api` 的 `invoke` 调用后端命令。
   - 后端执行异步任务（如 API 请求、加密解密），并通过 `Result` 返回数据。
4. **持久化**: 
   - 配置信息通过 `config_service` 存储在本地 JSON 文件中。
   - 头像等静态资源通过 `avatar_cache_service` 进行本地缓存。

## 5. 核心业务流程
- **账户登录**: 输入手机号/密码 -> 生成设备指纹 -> 获取验证码 -> 登录获取 Token/Cred。
- **角色数据**: 懒加载策略 -> 首次访问时从 Skland API 获取 -> 存入内存并同步至本地缓存。
- **仪表板**: 拖拽排序 -> 更新前端状态 -> 调用后端命令保存布局配置。
