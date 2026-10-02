# 侧边栏与抽卡图表组件 — 文件功能参考

> 逐文件精读源码生成。行号基于当前工作区版本，仅用于快速定位。

## `src/components/dashboard-sidebar.tsx`
**职责**：应用左侧全局侧边栏——展示当前选中账户卡片、可拖拽排序的主导航（仪表板/角色/勋章/出勤/抽卡）、仪表板多标签页列表（增删改、右键菜单、折叠）、底部功能入口与主题/语言切换；同时内含一个被硬关闭的命令面板式搜索模块。
**导出**：`Sidebar`（唯一导出，命名导出，无 default）
**主要依赖**：`react-router-dom`（`Link`/`useLocation`/`useNavigate`）、`react-dom` 的 `createPortal`、`react-i18next` 的 `useTranslation`、`clsx`、`@/components/ui/glass`（`GlassKbd`、`GlassSkeleton`）、`@/components/icons`（11 个图标）、`@/components/theme-switch`、`@/components/language-switch`、`@/components/ui/account-avatar`、`@/components/ui/app-icon`（`ChevronDownIcon`/`SwitchIcon`）、`./account-switch-modal`、`@/components/cards/card-context-menu`、`@/components/tab-editor-modal`、`@/components/ui/confirm-dialog`、`@/utils/accountService`、`@/utils/configService`、`@/utils/tabService`、`@/utils/tabIcons`、`@/utils/imageCacheManager`、`@/utils/logger`、`@/config/site`、`@/types`（`resolveServerLabel`）、`@/types/dashboard`（`DashboardTab`）

| 符号 | 位置 | 说明 |
| --- | --- | --- |
| `SearchResult` | dashboard-sidebar.tsx:50 | 接口：`id`、`title`、`description?`、`path`、`category`、`elementId?`（页面内锚点）、`titleEn/titleZh/descriptionEn/descriptionZh/categoryEn/categoryZh?`（跨语言检索字段）、`matchedLang?("current"/"en"/"zh")`、`matchedText?` |
| `SidebarProps` | dashboard-sidebar.tsx:69 | props：`onNavigate?: () => void`（移动端点击导航后关闭抽屉的回调） |
| `NavKey` | dashboard-sidebar.tsx:74 | 联合类型：`"dashboard" \| "characters" \| "medals" \| "attendance" \| "gacha"` |
| `NAV_KEYS` | dashboard-sidebar.tsx:76 | 默认导航顺序数组（5 项），作为 `navOrder` 初值 |
| `GripHandle` | dashboard-sidebar.tsx:84 | 六点拖拽手柄按钮（内联 SVG）。props：`onPointerDown`（必需）、`onDragEnd?`、`isDragging?`；`pointerUp`/`click` 均 `preventDefault+stopPropagation`（97-105），hover 时才显示（106） |
| `Sidebar` | dashboard-sidebar.tsx:123 | 主组件，123-1722 行，见下方内部结构 |

**内部结构**：

- **1-48 行**：import 区（依赖清单见上）。全文件无任何 Tauri `invoke`/`listen`，后端交互全部经由 `accountService`/`configService`/`tabService` 封装。
- **50-82 行**：类型与常量（`SearchResult`、`SidebarProps`、`NavKey`、`NAV_KEYS`）。
- **84-121 行**：`GripHandle` 子组件。
- **126-173 行**：状态/引用声明。搜索态 `searchQuery`/`showResults`/`selectedIndex`/`searchMenuPos` 与 refs（126-139）；账户态 `selectedAccount`/`isLoadingAccount`/`isSwitchModalOpen`/`isManualRefreshing`/`expectedAccountCount`（默认 3）（142-152）；`developerMode`（153）、`sidebarTabs`/`sidebarActiveTab`（154-155）、`isDashboardCollapsed`（156）、`contextMenu`（157-162）、`isTabEditorOpen`/`editingTabForSidebar`（163-166）；拖拽态 `navOrder`/`draggingNav`/`draggingTab` 及对应 ref（167-173）。
- **175-181 行**：把 `navOrder`、`sidebarTabs` 同步进 ref（供拖拽结束时读取最新值）。
- **184-196 行**：读取配置 `sidebar_nav_order`，过滤非法键并补齐缺失键后写入 `navOrder`。
- **198-232 行**：拖拽核心函数——`swapNav`（198，交换两个导航项）、`swapTab`（209，交换两个标签页）、`endNavDrag`（220，`setConfig("sidebar_nav_order", ...)` 持久化）、`endTabDrag`（227，`saveTabs(...)` 持久化）。
- **234-256 行**：`startNavDrag` / `startTabDrag`——标记拖拽目标并临时挂 `window pointerup` 监听以结束拖拽。
- **259-274 行**：加载标签页（`getAllTabs` + `getActiveTabId`），并监听 `tabsChanged`、`accountChanged` 两个 window 事件重载。
- **277-286 行**：监听 `themeChange` → `themeChangeKey++`，用于 952 行强制重挂 `<aside>`。
- **289-304 行**：读取配置 `developer_mode`、`sidebar_collapsed` 初始化状态。
- **307-315 行**：监听 `developerModeChange`（CustomEvent，`detail.enabled`）。
- **318-399 行**：选中账户加载与同步——`Promise.all([getSelectedAccount(), getAccounts()])`（323-326）并按 id 匹配；监听 `accountChanged`（348-371，重读配置 `refresh_on_account_switch`）、`manualRefresh`（374-393，`detail.count` 上限 5，置骨架屏 300ms 后复位）。
- **402-715 行**：`getAllSearchableContent`（`useMemo`，依赖 `t`/`i18n.language`）——硬编码的可检索条目表：导航项 `nav-dashboard`(406)/`nav-settings`(423)/`nav-account`(439)、仪表板块 456-628（welcome、stats-revenue/users/sales、activity、projects、quick-actions、create/start/invite、analytics）、设置块 630-696（settings-title/general/language/theme）、`nav-developer`(697-712)，每条含中英双语 title/description/category 与可选 `elementId`。
- **718-788 行**：`searchResults`（`useMemo`）——先按当前语言再按中/英备选语言匹配（725-742），再标注 `matchedLang` 与 `matchedText`（743-787）。
- **791-801 行**：`Cmd/Ctrl+K` 聚焦搜索框。
- **804-818 行**：点击外部/滚动时关闭搜索结果。
- **821-847 行**：搜索结果键盘导航（↑↓/Enter/Escape）。
- **850-860 行**：选中项 `scrollIntoView`。
- **862-899 行**：`handleSelectResult`——`navigate(path)`、清空搜索状态；有 `elementId` 时延迟 100ms 滚动到元素（偏移 80px）并加 `animate-pulse` + 光圈高亮 2 秒。
- **901-922 行**：`highlightMatch(text, query)`——转义正则后 split 并用 `<mark>` 包裹命中片段。
- **924-948 行**：`bottomItems`（`useMemo`）——账户项固定；`developerMode` 为真时插入开发者项；最后追加设置项。
- **950-1016 行**：渲染起点——`<aside key={themeChangeKey}>`（952）+ 账户卡片区三态：骨架屏（955-962）/ 已选账户（963-996，含头像、昵称、`Lv.`、`resolveServerLabel` 服务器、森空岛 userId、hover 显示切换按钮 `setIsSwitchModalOpen(true)`）/ 未选择占位（997-1014）。
- **1018-1237 行**：搜索区，**被 `{false && ...}` 硬关闭（1019）**：输入框 1024-1061、清除按钮 1062-1086、⌘K 提示 1087-1092、`createPortal(document.body)` 下拉 1096-1234、按 category 分组 1121-1133、结果项按钮 1138-1204（含 EN/中文 命中徽章 1166-1173、跨语言匹配文本 1184-1200）、底部快捷键页脚 1210-1231。
- **1239-1593 行**：主导航 `<nav>`，按 `navOrder.map` + `switch` 渲染，每项 hover 时与 `draggingNav` 交换位置：
  - `dashboard`（1244-1421）：`Link to="/"` + 折叠按钮（1281-1305，`setConfig("sidebar_collapsed", next)`）+ `GripHandle`(1306)；子级标签列表用 `grid-template-rows: 0fr/1fr` 做展开动画（1314-1322）；「Tabs」标题 + `PlusIcon` 新增按钮（1325-1340）；标签项 1341-1407（右键 `onContextMenu` 开菜单 1352-1361、hover 拖拽交换 1362-1366、点击 `setActiveTabId` 后派发 `accountChanged` 1370-1377、激活态左侧竖条 1388-1390）；空态 1408-1416。
  - `characters`（1423-1463）、`medals`（1465-1505）、`attendance`（1507-1547）、`gacha`（1549-1589）：结构相同，仅路由/图标/文案不同。
- **1595-1638 行**：`CardContextMenu`（标签页右键）——`edit` 取回标签后打开编辑器（1604-1611）；`delete` 走 `confirmDialog` 确认后 `removeTab` 并派发 `tabsChanged`（1617-1633）。
- **1640-1660 行**：`TabEditorModal`——`onSave` 按是否在编辑调用 `updateTab` 或 `addTab(name, icon, tags, defaultRoleId)`，随后刷新并派发 `tabsChanged`。
- **1662-1711 行**：页脚——`bottomItems` 链接列表（1666-1694）、GitHub 外链（`siteConfig.links.github`，1698-1706）、`ThemeSwitch`、`LanguageSwitch`。
- **1714-1719 行**：`AccountSwitchModal`（`isOpen`/`onClose`/`currentAccountId`）。

**备注**：
- **invoke 命令**：本文件 0 个（无 `@tauri-apps/api/core` 引用）；后端能力经 `getAccounts`/`getSelectedAccount`/`getConfig`/`setConfig`/`getAllTabs`/`addTab`/`updateTab`/`removeTab`/`saveTabs`/`getActiveTabId`/`setActiveTabId` 间接调用。
- **listen/事件**（全部为 DOM 事件，非 Tauri `listen`）：
  - 监听：`window "tabsChanged"`(268)、`window "accountChanged"`(269, 371)、`window "themeChange"`(282)、`window "developerModeChange"`(312)、`window "manualRefresh"`(393)、`window "pointerup"`(243, 255)、`document "keydown"`(799, 844)、`document "mousedown"`(812)、`window "scroll"` capture(813)。
  - 派发：`window.dispatchEvent(accountChanged)`(1373-1375)、`window.dispatchEvent(tabsChanged)`(1632, 1657)。
- **配置键（configService）**：读 `sidebar_nav_order`(185)、`developer_mode`(291)、`sidebar_collapsed`(300)、`refresh_on_account_switch`(353)；写 `sidebar_nav_order`(222)、`sidebar_collapsed`(1286)。
- **Props 清单**：`Sidebar` 仅 `onNavigate?: () => void`（默认 `{}`，123）。
- **异常/注意点**：① 搜索 UI 被 `{false && ...}` 永久隐藏（1019），但其状态、4 个键盘/鼠标 effect 与约 500 行 JSX 仍保留在文件中（1018-1237，属死代码）。② `handleManualRefresh` 中 `void expectedAccountCount`(380) 为规避 lint 的占位，且 390 行 `logger.debug` 读到的是闭包旧值。③ `highlightMatch`(904-911) 用带 `g` 标志的正则做 `.test()`，`lastIndex` 有状态残留风险。④ 1272 行判断 `location.pathname === ""`（其余处均为 `"/"`），该分支实际不会命中。⑤ `startNavDrag`/`startTabDrag` 注册的 `pointerup` 监听只在触发后移除，拖拽中途卸载组件会短暂泄漏。

## `src/components/gacha-pity-chart.tsx`
**职责**：抽卡「寻访统计」保底条形图——按卡池分组，以横向柱条展示每次六星距离上个六星的抽数（或赠送十连内序号）及未出六星的余量，柱头附角色/武器圆形头像，支持卡池筛选与中英文案。
**导出**：`GachaPityChart`（default 导出）
**主要依赖**：`echarts`（自定义 `custom` series + `renderItem` 手绘）、`@tauri-apps/api/core` 的 `invoke`、`@/components/ui/glass`（`GlassCard`、`GlassSelect`）、`@/utils/imageCacheManager`（`cacheManager`、`usePinImages`）、`@/utils/logger` 的 `logError`、`@/types/gacha`（`GachaCategory`/`GachaPoolInfo`/`GachaPoolKind`/`GachaRecord`）

| 符号 | 位置 | 说明 |
| --- | --- | --- |
| `poolKindOf` | gacha-pity-chart.tsx:10 | 记录 → 卡池类型：优先 `pools[poolId].poolType` 含 `Joint`/`Standard`，否则按 `poolId` 前缀 `joint_`/`standard` 推断，兜底 `special` |
| `ChartRow` | gacha-pity-chart.tsx:22 | 行数据：`kind: "six" \| "leftover"`、`id?`（角色/武器 id，供图标）、`name`、`count`、`gachaTs?`、`inGift` |
| `ChartSection` | gacha-pity-chart.tsx:32 | 分组：`poolId`、`poolName`、`rows: ChartRow[]` |
| `computeSections` | gacha-pity-chart.tsx:41 | 核心：记录过滤 + 按 `poolId` 合并 + 保底计数（见下） |
| `firstSixTs` | gacha-pity-chart.tsx:120 | 卡池排序键：区间内最旧六星的 `gachaTs`；无六星则取 `leftover` 行时间 |
| `cssVar` | gacha-pity-chart.tsx:132 | 读 CSS 变量，缺省回退 |
| `circleAvatar` | gacha-pity-chart.tsx:138 | 经 `cacheManager.load` 取图 → 96px canvas 圆形裁剪 → PNG dataURL |
| `ROW_H`/`AVATAR_SIZE`/`GRID_LEFT`/`GRID_RIGHT`/`BAR_GAP`/`BAR_START_GAP`/`CHART_BOTTOM_PAD` | gacha-pity-chart.tsx:172-178 | 布局常量：44 / 36 / 84 / 64 / 10 / 10 / 14 |
| `HEADER_FONT` | gacha-pity-chart.tsx:180 | 卡池分组头字体 `600 12px system-ui...` |
| `_measureCtx` / `measureTextWidth` | gacha-pity-chart.tsx:182 / 183 | 离屏 canvas 测量文本宽度（SSR 兜底 `len*8`） |
| `ChartProps` | gacha-pity-chart.tsx:189 | 见 props 清单 |
| `GachaPityChart` | gacha-pity-chart.tsx:197 | 主组件，197-630 行 |
| `ChartHeader` | gacha-pity-chart.tsx:632 | 头部：标题 + `GlassSelect` 卡池下拉 + 图例（六星/未出六星）+ 六星总数 |
| `hexWithAlpha` | gacha-pity-chart.tsx:678 | hex（3/6 位）→ `rgba()`，用于渐变柱体配色 |
| `escapeHtml` | gacha-pity-chart.tsx:695 | tooltip HTML 转义 |
| `formatTime` | gacha-pity-chart.tsx:703 | `gachaTs` → `toLocaleString(zh-CN/en-US)` |

**Props（`ChartProps`，gacha-pity-chart.tsx:189-195）**：`roleId: string | null`（头像映射用）、`records: GachaRecord[]`（假定从新到旧）、`pools: Record<string, GachaPoolInfo>`、`category: GachaCategory`、`isZh: boolean`。
`ChartHeader` props（632-644）：`isZh`、`sixCount`、`poolOptions: {poolId,poolName}[]`、`poolFilter: string | null`、`onPoolChange: (v: string|null) => void`。

**输入数据结构**：`GachaRecord`（仅 `kind === "draw"` 参与，49/209）——用到 `poolId`、`poolName`、`poolType`（经 pools）、`rarity`、`isFree`、`charId`/`weaponId`、`charName`/`weaponName`/`nameText`、`gachaTs`；`GachaPoolInfo` 提供 `poolName`/`poolType`。中间结构 `ChartRow`/`ChartSection` 见表。

**图表类型与配置**：图表库 **ECharts**（`echarts.init`，332），**水平条形图**（`series.type: "custom"` + `renderItem` 自绘，434-594）。
- `grid`（368）：`left: GRID_LEFT(84)`、`right: GRID_RIGHT(64)`、`top: 0`、`bottom: CHART_BOTTOM_PAD(14)`。
- `xAxis`（369-377）：`type: "value"`，`min: 0`、`max: maxCount`（363：`max(10, 所有非 header 行的 count)`），轴线/刻度/标签/分隔线全部隐藏。
- `yAxis`（378-385）：`type: "category"`，`data` 为 `r0..rN`（362），`inverse: true`（首行在顶部），轴元素全隐藏。
- `tooltip`（386-419）：`trigger: "item"`，玻璃拟态 className，`formatter`（395-418）按 `meta[dataIndex].kind` 区分卡池名 / 六星（含「距上个六星 N 抽」或「赠送十连内第 N 抽」+ 时间）/ 未出六星余量。
- `graphic`（420-433）：`GRID_LEFT` 处的竖直分隔线，高度 = `meta.length * ROW_H`。
- `series`（434-594）：`type: "custom"`、`name: "pity"`、`clip: false`，`data` 每项 `value = header ? 0 : count`（439-442），`encode: {x:0,y:1}`；`renderItem`（444-593）：header 行绘制底纹 + 两段横线 + 截断的卡池名（450-495）；数据行依次绘制圆形头像或首字母占位圆（506-535）、圆角柱体（`r:[0,10,10,0]`）+ 线性渐变（六星用 `--primary`，余量用 `--default-400`）（538-560）、右侧计数标签（563-574）、赠送六星的红色「赠」字（577-590）。

**计算逻辑（保底计数公式，`computeSections`，gacha-pity-chart.tsx:41-117）**：
- 47-61：按 `poolId` 聚合 `draw` 记录（`weapon`/`all` 分类不过滤，否则用 `poolKindOf` 过滤），组内保持输入的从新到旧顺序。
- 66-67：变量 `n` = 距上一个**普通**六星的非赠送抽数（卡池区间起点归零）；`giftPos` = 当前赠送十连内的位置。
- 69-99：从 `rows.length-1` 反向遍历（即**从旧到新**）：`isFree` 时 `giftPos++`，若 `rarity===6` 则产出 `kind:"six"` 行，`count = giftPos`、`inGift: true`（71-82）；非赠送时先 `giftPos = 0`，若 `rarity===6` 产出六星行 `count = n + 1` 后 `n = 0`，否则 `n += 1`（83-98）。
- 100-108：区间结束后若 `n > 0`，产出 `kind:"leftover"` 行（`count = n`，`gachaTs` 取最新一条记录）。
- 109-111：空组丢弃。
- 115：卡池按 `firstSixTs` 降序（最旧六星时间最新者在前；无六星按最近记录时间）。
- 318-325 `meta`：把每个 `ChartSection` 展开为 `header` 行 + 各数据行，行高固定 `ROW_H`，即图表总高 `meta.length * 44 + 14`（625）。

**内部流程要点**：205-219 `poolOptions`；221-226 `poolFilter` 状态（切分类时重置）；228-235 过滤后调 `computeSections`；238-246 收集六星 `neededIds`；253-269 **`invoke("resolve_gacha_avatar_map", { roleId })`** 合并头像映射（带 `resolvingRef` 防重入，失败仅 `logError`）；273-280 `usePinImages` 预缓存；282-304 批量 `circleAvatar` 生成圆形 dataURL；307-312 监听 `themeChange` 触发重绘；330-341 `echarts.init` + `ResizeObserver`（仅 `hasRows` 时挂载，变化即重建）；343-346 `sixCount`；349-599 生成并 `setOption(option, true)`；601-616 空数据时只渲染头部与提示。

**备注**：
- **invoke 命令**：`resolve_gacha_avatar_map`（gacha-pity-chart.tsx:258，参数 `{ roleId }`，返回 `Record<string,string>` id→图片 src）。全文件仅此 1 个。
- **listen 事件**：无 Tauri `listen`；仅有 `window.addEventListener("themeChange")`（310，附带 `window.removeEventListener` 清理）。
- **Props 清单**：`roleId`、`records`、`pools`、`category`、`isZh`；子组件 `ChartHeader` 的 `isZh`、`sixCount`、`poolOptions`、`poolFilter`、`onPoolChange`。
- **异常/注意点**：① `poolKindOf` 与 `cssVar` 与 `gacha-stat-charts.tsx` 完全重复实现。② 282-304 的 effect 依赖写成 `neededIds.join(",")` 并显式 `eslint-disable`（303-304）。③ `ChartRow.name` 类型非可选，但 tooltip 中仍有 `row.name ?? "?"`（404）等防御写法。④ 卡池合并逻辑依赖 `records` 从新到旧的隐含约定（注释 46/68）。⑤ 头像映射按 `roleId` 维度整体请求，缺失 id 由后端在 `total.json` 中按名称补全（注释 248）。

## `src/components/gacha-stat-charts.tsx`
**职责**：抽卡统计三联图容器——星级占比环形图、六星间隔折线图（含期望参考线）、累计六星折线图（含期望参考线），全部基于同一份按时间升序的记录派生。
**导出**：`GachaStatCharts`（default 导出）
**主要依赖**：`echarts`、`@/components/ui/glass` 的 `GlassCard`、`@/types/gacha`（`GachaCategory`/`GachaPoolKind`/`GachaRecord`）；无任何 Tauri 调用

| 符号 | 位置 | 说明 |
| --- | --- | --- |
| `SIX_STAR_EXPECTATION` | gacha-stat-charts.tsx:7 | 角色六星期望 `35.5` 抽/个 |
| `WEAPON_SIX_STAR_EXPECTATION` | gacha-stat-charts.tsx:8 | 武器六星期望 `25` 抽/个 |
| `cssVar` | gacha-stat-charts.tsx:10 | 读 CSS 变量（与 pity 图重复） |
| `useEchart` | gacha-stat-charts.tsx:16 | Hook：监听 `themeChange` 产生 `themeTick`（18-22），`echarts.init` + `ResizeObserver`（26-38），返回 `{ setOption }`（40-45，`setOption(option, true)`） |
| `useChronoRecords` | gacha-stat-charts.tsx:49 | 过滤当前分类的 `draw` 记录并按 `Number(gachaTs)` **升序**（55-61）；`weapon`/`all` 不分类过滤，其余用 `poolKindOf` |
| `poolKindOf` | gacha-stat-charts.tsx:66 | 与 pity 图同名同逻辑的重复实现 |
| `useStarDistribution` | gacha-stat-charts.tsx:79 | 按 `rarity` 计数 → `{ total, series: [rarity, count][] }`，按稀有度降序（87） |
| `useSixIntervals` | gacha-stat-charts.tsx:93 | **六星间隔序列**（见下）→ `{ intervals: number[], avg: number \| null }` |
| `useCumulativeSix` | gacha-stat-charts.tsx:111 | **累计曲线**：`points: [number,number][]` 起点 `[0,0]`，每抽 `draws++`、命中六星 `six++` 后 push `[draws, six]`（115-120，含赠送抽）→ `{ points, totalDraws, totalSix }` |
| `RARITY_COLORS` | gacha-stat-charts.tsx:125 | 稀有度配色：6 `#ef4444`、5 `#ffd700`、4 `#a855f7`、3 `#94a3b8` |
| `GachaStatCharts` | gacha-stat-charts.tsx:132 | 主组件，132-376 行 |

**Props（132-144）**：`records: GachaRecord[]`、`pools: Record<string, { poolType: string }>`、`category: GachaCategory`、`isWeapon: boolean`、`isZh: boolean`。

**输入数据结构**：`GachaRecord` 中的 `kind`、`poolId`、`rarity`、`isFree`、`gachaTs`；`pools` 仅需 `poolType`。派生结构：`{total, series}`（星级分布）、`intervals`（间隔数组）、`points: [累计抽数, 累计六星][]`。

**计算逻辑（行号）**：
- 期望值选择：145 `expectation = isWeapon ? 25 : 35.5`。
- **六星间隔公式** `useSixIntervals`（93-108）：遍历升序记录，`isFree` 直接跳过（98，赠送抽不计数、赠送六星不打断计数）；否则 `since += 1`，若 `rarity === 6` 则 `intervals.push(since)` 并 `since = 0`（99-104）；`avg = sum(intervals)/len`（105）。
- **累计公式** `useCumulativeSix`（111-123）：逐抽累加，含赠送抽。
- **星级占比** `useStarDistribution`（79-90）：Map 计数 + 总数，percent 在 204-208 计算为 `round(c/total*1000)/10`（保留 1 位小数）。

**图表类型与配置**（三个容器均固定高 220px：353/360/372，库为 **ECharts**，各由一个 `useEchart` 实例驱动）：

1. **星级分布环形图**（effect 165-213）
   - `series[0].type: "pie"`，`radius: ["45%","72%"]`、`center: ["50%","44%"]`、`avoidLabelOverlap`（191-193）；label `"{c} ({d}%)"`（194-199），`labelLine` 长度 8/6（200）。
   - `legend` 置底，数据为 `"6★".."3★"`（181-187）；调色板取自 `RARITY_COLORS`（167）。
   - tooltip `trigger: "item"`，formatter 输出名称与 `值 (百分比%)`（176-179）。
2. **六星间隔折线图**（effect 215-283）——标题写作「分布」但 **`series.type: "line"`**（259）
   - 数据 `lineData = intervals.map((n,i) => [i+1, n])`（217）；`showSymbol: true`、`symbolSize: 6`、`smooth: true`、渐变 `areaStyle`（261-266）。
   - `xAxis` value：`min: 1`、`max: max(intervals.length,1)`、`minInterval: 1`、无分隔线，name「六星序号 / 6★ #」（236-245）。
   - `yAxis` value：`min: 0`、`max: maxY + 4`，`maxY = Math.max(expectation, ...intervals, 1)`（218），name「间隔抽数 / pulls」（246-255）。
   - `markLine`（267-278）：红色虚线 `yAxis: expectation`，label `期望 35.5 抽 / Expected 35.5`（216）。
   - tooltip `trigger: "axis"`，formatter 输出「第 N 个六星 / 间隔 M 抽」（230-234）。
3. **累计六星折线图**（effect 285-345）
   - `series.type: "line"`，`data: cumulative.points`（323），`showSymbol: false`、`smooth`、渐变面积（324-328）。
   - `xAxis` value `0..max(1,totalDraws)`（286, 304-310）；`yAxis` value `0..max(1,totalSix)`、`minInterval: 1`（287, 311-318）。
   - `markLine`（329-340）：红色虚线 `xAxis: expectation`（339）——在累计抽数 = 期望值处画竖参考线，label「期望 35.5 抽」（333）。
   - tooltip `trigger: "axis"`，输出「累计 N 抽 / 六星: M」（299-302）。

**渲染（347-375）**：`grid grid-cols-1 lg:grid-cols-3 gap-4` 内嵌三个 `GlassCard`，标题分别为「星级分布」（351）、「六星间隔分布（期望 N 抽）」（357）、「六星累计」（370）；中间卡片在 `intervals.length === 0` 时叠加「暂无六星记录」空态（361-365）。

**备注**：
- **invoke 命令**：0 个（未引入 `@tauri-apps/api/core`）。
- **listen 事件**：无 Tauri `listen`；仅 `window.addEventListener("themeChange")`（gacha-stat-charts.tsx:20，在 `useEchart` 内）。
- **Props 清单**：`records`、`pools`、`category`、`isWeapon`、`isZh`。
- **异常/注意点**：① `useSixIntervals` 的 `avg`（105、148）除作为 effect 依赖（283）外从未被渲染使用，属冗余值。② 中间卡片标题为「六星间隔**分布**」，实际是按六星序号排列的折线图而非直方图。③ 累计图的期望参考线画在 `xAxis`（累计抽数）而非斜率上，语义上与「累计六星数」的期望斜率并不等价。④ 环形图未处理空数据空态（仅有中间卡片有）。⑤ `poolKindOf`/`cssVar` 与 `gacha-pity-chart.tsx` 重复。
