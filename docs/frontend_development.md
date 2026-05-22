# 前端开发规范与拓展指南

## 1. 目录结构与文件定位
- **页面组件**: `src/pages/` (如 `dashboard.tsx`, `account.tsx`)
- **通用组件**: `src/components/` (如 `custom-modal.tsx`, `navbar.tsx`)
- **卡片组件**: `src/components/cards/` (专门用于仪表板的卡片)
- **工具类**: `src/utils/` (封装 Tauri Invoke 调用及数据处理逻辑)
- **类型定义**: `src/types/` (TypeScript 接口与类型)

## 2. 开发规范
- **状态管理**: 优先使用 React Hooks (`useState`, `useEffect`)。对于跨组件共享的复杂状态，建议使用 Context API 或 Zustand（若后续引入）。
- **样式编写**: 使用 Tailwind CSS 进行原子化样式开发，避免编写大量自定义 CSS。
- **国际化**: 所有用户可见文本必须通过 `useTranslation` hook 从 `locales/` 目录获取。
- **日志记录**: 使用 `src/utils/logger.ts` 提供的 `logInfo`, `logError` 等方法，禁止直接使用 `console.log`。

## 3. 拓展位置与方法

### 3.1 新增仪表板卡片
1. **定义类型**: 在 `src/types/dashboard.ts` 中添加新的卡片类型标识。
2. **创建组件**: 在 `src/components/cards/` 下创建新卡片组件（例如 `MyNewCard.tsx`）。
3. **注册渲染**: 在 `src/pages/dashboard.tsx` 的渲染逻辑中，根据卡片类型动态加载新组件。
4. **配置支持**: 更新 `src/utils/dashboardConfig.ts`，确保新卡片可以被添加和保存。

### 3.2 新增页面路由
1. **创建页面**: 在 `src/pages/` 下创建新页面组件。
2. **配置路由**: 在 `src/App.tsx` 中使用 `react-router-dom` 的 `<Route>` 注册新路径。
3. **导航入口**: 在 `src/components/navbar.tsx` 或侧边栏中添加跳转链接。

### 3.3 新增后端命令调用
1. **封装服务**: 在 `src/utils/` 下创建或更新服务文件（如 `xxxService.ts`）。
2. **定义类型**: 确保请求参数和返回值的 TypeScript 类型已定义。
3. **错误处理**: 统一使用 `try-catch` 捕获 `invoke` 异常，并通过 `logger` 记录。

## 4. 拓展流程示例：添加一个新的数据展示卡片
1. **需求分析**: 确定卡片需要展示的数据字段及来源。
2. **后端准备**: 确认后端已有对应的 Tauri Command 提供数据。
3. **前端实现**:
   - 编写卡片 UI 组件。
   - 在 `dashboard.tsx` 中集成该组件。
   - 在 `add-card-modal.tsx` 中添加该卡片的选项。
4. **测试验证**: 运行项目，测试卡片的添加、数据显示及拖拽排序功能。
