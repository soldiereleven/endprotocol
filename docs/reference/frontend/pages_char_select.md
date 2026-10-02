# 干员选择页 src/pages/char-select.tsx — 功能参考

> 逐行精读源码生成。行号基于当前工作区版本（全文件 2561 行），仅用于快速定位。

**文件职责**：以 `CustomModal` 弹窗形式实现「干员多槽位选择 + 六维筛选列表 + 干员详情（技能/天赋/潜能/装备 + Wiki 说明）」的完整交互；包含手写鼠标拖拽换槽、Wiki 详情拉取与图片预取。该文件当前**未被任何模块 import**，实际生效的实现是 `src/components/cards/character-list/char-select-modal.tsx`（见备注）。

**导出**：
- `FilterKey`（type，char-select.tsx:51）
- `FloatSelect`（char-select.tsx:88）
- `OperatorCard`（char-select.tsx:203）
- `rarityLineColorLocal`（char-select.tsx:333）
- `CharSelectModal`（char-select.tsx:346，页面主组件；配套 props 接口 `CharSelectModalProps` 在 :54）

**主要依赖**：
- 项目内：`@/components/ui/glass`（GlassAlert/GlassButton/GlassChip/GlassMeter/GlassProgressCircle）、`@/components/custom-modal`（CustomModal/Header/Body）、`@/types/charDetail`（CharDetailData/CharacterItem）、`@/utils/wikiTableParser`（getWikiRenderedBlocks、WIKI_COLOR_MAP）、`@/utils/imageLoader`（Img）、`@/utils/imageCacheManager`（useImageRequest）、`@/utils/roleDataService`、`@/utils/configService`（getConfig）、`@/utils/logger`（logError）
- 第三方：`react`（useState/useEffect/useLayoutEffect/useRef/useMemo/useCallback）、`react-dom`（createPortal）、`react-i18next`（useTranslation）

## 内部结构总览
| 区间 | 内容 |
| --- | --- |
| 1-29 行 | React / react-dom、glass UI、custom-modal、类型与工具服务 import |
| 31-49 行 | 常量与图标路径辅助：`SKILL_BG_COLORS`、`SKILL_BG_CIRCLE`、`ICON_BASE`、`professionIconUrl`、`propertyIconUrl`、`RARITY_ICON_URL` |
| 51-64 行 | `FilterKey` 类型、`CharSelectModalProps` 接口 |
| 66-78 行 | `rarityTone` 稀有度色阶函数与 `rarityToneClass` 类名映射 |
| 80-199 行 | `FloatSelectOption` 接口与 `FloatSelect` 下拉组件（createPortal 定位、点击外部/滚动关闭） |
| 201-330 行 | `OperatorCard` 列表卡组件（立绘背景、职业/属性角标、pinned 指示、potential/进化/等级底栏、拖拽 mousedown） |
| 332-344 行 | `rarityLineColorLocal` 稀有度色条颜色 |
| 346-448 行 | `CharSelectModal` 签名与全部 state/refs（选中槽位、视图模式、Wiki 状态、拖拽、动画 ref、成功提示） |
| 450-531 行 | `tempSelectedIdsRef` 同步 effect；`handleDragStart` 手写拖拽（阈值判定、槽位命中、mouseup 投放） |
| 533-559 行 | 六维筛选 state、`setFilter`、`resetFilters`；滚动/筛选面板显示状态、`modalBodyRef` |
| 561-659 行 | `resetWikiState`；打开弹窗全量重置 effect；进入 detail 重置选中项 effect；`useLayoutEffect` 拉取 Wiki 详情；离开 detail 重置 Wiki；动画 ref 清理 effect |
| 661-699 行 | `renderRarityIcons` 星标渲染；`sortedCharacters` 排序 |
| 701-791 行 | `getSubProperty` 副能力派生；六个筛选选项 `unique*` memo；`filteredCharacters` 过滤；`getCharById` / `getCharItemById` |
| 793-849 行 | 列表封面路径 `gridAvatarPaths`、详情图片路径 `detailImagePaths`、合并 `allCachePaths` 与 `useImageRequest` 预取 |
| 851-891 行 | `handleDropOnSlot`、`handleRemoveFromSlot`、`handleScroll` |
| 893-905 行 | 顶部浮动成功提示（GlassAlert） |
| 907-1139 行 | `CustomModal` 容器；detail 分支 IIFE 起始：上下文变量、`groupChains`、`findItem`、`isNodeUnlocked`、`talentIcon`、`btnBase`、`equipData` 装备数据组装 |
| 1140-1269 行 | detail 外框、关闭按钮（区分「卡片进入/直接进入」）、Wiki 加载转圈、左栏立绘、右栏信息头 |
| 1271-1656 行 | 详情主体：技能行、能力天赋行、被动技能链、养成天赋链、潜能行、右侧装备列 |
| 1658-1707 行 | 选中遮罩 backdrop、右侧滑出抽屉外壳与收起按钮 |
| 1708-2239 行 | 抽屉内容：技能等级/等级进度条、Wiki 文本块渲染、潜能 contentDoc 段落渲染、数值表（当前→下一级 delta） |
| 2240-2253 行 | detail 分支收尾；list 分支 `CustomModalHeader` |
| 2255-2345 行 | 槽位栏（Slot Bar，不随内容滚动）：槽位卡片、已选头像与名字、移除按钮、空槽占位 |
| 2347-2493 行 | `CustomModalBody`（滚动监听）：六维 `FloatSelect` 筛选区 + 重置按钮；角色网格 `OperatorCard`；空结果提示 |
| 2495-2528 行 | 返回顶部悬浮按钮（滚动百分比 / hover 图标切换） |
| 2530-2561 行 | 拖拽 ghost（跟随鼠标）渲染；组件收尾 |

## 组件与函数清单
| 符号 | 位置 | 说明 |
| --- | --- | --- |
| `SKILL_BG_COLORS` | char-select.tsx:31 | 技能属性→背景色映射（pulse/fire/natural/cryst/physical） |
| `SKILL_BG_CIRCLE` | char-select.tsx:38 | 技能圆底灰色 `#6d6d6d` |
| `ICON_BASE` | char-select.tsx:46 | 图标根路径 `/assets/icons`（注释标注职业/属性图标为占位资源） |
| `professionIconUrl` | char-select.tsx:47 | 拼职业图标 URL |
| `propertyIconUrl` | char-select.tsx:48 | 拼属性图标 URL |
| `RARITY_ICON_URL` | char-select.tsx:49 | 稀有度星标 `/assets/rarity.svg` |
| `FilterKey` | char-select.tsx:51 | 六个筛选维度的联合类型（export） |
| `CharSelectModalProps` | char-select.tsx:54 | 弹窗 props：isOpen/onClose/charDetail/selectedCharIds/onSave/roleId/initialCharId/initialViewMode/maxSlots |
| `rarityTone` | char-select.tsx:67 | 6★→orange、5★→gold、4★→purple、其余 blue |
| `rarityToneClass` | char-select.tsx:73 | tone→Tailwind 文本色类 |
| `FloatSelectOption` | char-select.tsx:83 | 下拉选项类型（value/label/tone） |
| `FloatSelect` | char-select.tsx:88 | WIKI 风格下拉：trigger 按钮 + portal 面板、外部点击/滚动关闭（export） |
| `OperatorCard` | char-select.tsx:203 | 角色卡：立绘 cover、pinned 蓝点、potential/evolve/level 角标、稀有度底色条；mousedown 触发拖拽、区分点击与拖动（export） |
| `rarityLineColorLocal` | char-select.tsx:333 | 稀有度→色条颜色（6→#ff7100、5→#ffcc00、4→#b380ff、其他 transparent）（export） |
| `CharSelectModal` | char-select.tsx:346 | 主组件：列表/详情双视图 + 槽位管理（export） |
| `potentialData`（useMemo） | char-select.tsx:384 | 从 `wikiDetail.document.chapterGroup` 中定位「干员潜能」章节 widget，按 tab 生成 1..N 级潜能（level/iconUrl/contentDoc） |
| `openDetailPanel` | char-select.tsx:414 | 打开右侧抽屉：先写内容，rAF 下一帧置 active 以触发宽度动画 |
| `closeDetailPanel` | char-select.tsx:432 | 收起抽屉：先关动画，300ms 后清空内容 |
| `handleDragStart` | char-select.tsx:454 | 仅左键；document 级 mousemove/mouseup；5px 阈值区分点击与拖拽；命中检测后调 `handleDropOnSlot` |
| `setFilter` | char-select.tsx:542 | 单维度写入 filters |
| `resetFilters` | char-select.tsx:544 | 六维全部复位为 `all` |
| `resetWikiState` | char-select.tsx:562 | 清空 wikiLoading / wikiDetail |
| Wiki 加载 `useLayoutEffect` | char-select.tsx:595 | 进入 detail 且有 `wikiItemId`（非 "0"）时：先置 loading，再读配置、拉 `roleDataService.getWikiItemDetail`，cancelled 标记防竞态 |
| 离开 detail 重置 effect | char-select.tsx:646 | 用 `prevViewMode` 判断从 detail 切走时重置 Wiki |
| 动画清理 effect | char-select.tsx:654 | 卸载时 cancelAnimationFrame / clearTimeout |
| `renderRarityIcons` | char-select.tsx:661 | 按稀有度数值渲染 N 个星标 img |
| `sortedCharacters` | char-select.tsx:679 | 已选(pinned)优先 → 稀有度降序 → 等级降序 → 名称 zh-Hans 升序 |
| `getSubProperty` | char-select.tsx:703 | 取 `charData.tags` 中第一个不等于主属性的 tag 作为副能力 |
| `uniqueProfessions/Properties/Rarities/Weapons` | char-select.tsx:713/721/729/737 | 筛选选项去重（稀有度按数值降序） |
| `uniqueMainAttrs` | char-select.tsx:746 | 主能力 = property 的别名 |
| `uniqueSubAttrs` | char-select.tsx:749 | 副能力去重集合 |
| `filteredCharacters` | char-select.tsx:759 | 六维 AND 过滤 |
| `getCharById` / `getCharItemById` | char-select.tsx:784 / 789 | 按 id 取 charData / 完整 CharacterItem |
| `gridAvatarPaths` | char-select.tsx:794 | 列表封面（illustrationUrl→avatarRtUrl→avatarSqUrl） |
| `detailImagePaths` | char-select.tsx:807 | 详情页用图：立绘、头像、技能/三类天赋图标、武器/护甲/护手/双配件/战术物品图标 |
| `allCachePaths` | char-select.tsx:844 | 两类路径合并，交给 `useImageRequest`（:849） |
| `handleDropOnSlot` | char-select.tsx:852 | 同槽去重校验→写入→`setTimeout(onSave)`→成功提示 3s |
| `handleRemoveFromSlot` | char-select.tsx:874 | splice 移除后尾部补 `""`→`setTimeout(onSave)` |
| `handleScroll` | char-select.tsx:883 | 计算滚动百分比、>50% 显示返回顶部 |
| `groupChains`（detail IIFE 内） | char-select.tsx:923 | 天赋按去掉 `_数字` 后的 baseId 分组并按尾号排序成链 |
| `findItem`（detail IIFE 内） | char-select.tsx:940 | 按 `selectedDetailItem` 类型在技能/潜能/三类天赋中取条目 |
| `isNodeUnlocked`（detail IIFE 内） | char-select.tsx:971 | 用 `talent.latestPassiveSkillNodes` / `attrNodes` / `latestSpaceshipSkillNodes` 判定节点解锁（skill 恒 true） |
| `talentIcon`（detail IIFE 内） | char-select.tsx:991 | 未解锁时图标降透明度并叠加锁 svg |
| `btnBase`（detail IIFE 内） | char-select.tsx:1022 | 天赋/技能按钮样式工厂（圆形/圆角、解锁黄框、选中放大） |
| `equipData`（detail IIFE 内） | char-select.tsx:1038 | 六格装备：weapon/body/arm/acc1/acc2/tactical，做 icon/name/rarity/level 归一化 |
| `getPotentialSegments`（抽屉 IIFE 内） | char-select.tsx:1769 | 从潜能 contentDoc 的 blockMap 提取 text/link 富文本段（跳过 table/horizontalLine，颜色经 `WIKI_COLOR_MAP` 映射） |
| 槽位栏渲染 | char-select.tsx:2256 | `Array.from({length: maxSlots})`，注册 `slotRefs`，展示头像/名字/`common.slot`/移除按钮或空态 |
| 筛选区渲染 | char-select.tsx:2356 | 六个 `FloatSelect` + 圆形重置 `GlassButton` |
| 角色网格渲染 | char-select.tsx:2466 | 空态提示或响应式 3~8 列 `OperatorCard` 网格 |
| 返回顶部按钮 | char-select.tsx:2498 | `modalBodyRef.scrollTo` 平滑回顶，hover 切换图标 |
| 拖拽 ghost | char-select.tsx:2531 | fixed 定位的头像+名字，跟随 `dragPos` |

## 关键业务逻辑

**筛选与排序（678-781、712-756、2356-2463）**
排序：已选优先 → 稀有度降序 → 等级降序 → `localeCompare("zh-Hans-CN")` 名称升序。筛选六维独立取值（`all` 表示不过滤）：profession / rarity / property / weapon / mainAttr（等价于 property，773 行重复判定）/ subAttr（由 `getSubProperty` 从 tags 派生，与主属性相同的 tag 被跳过）。选项由字符数组去重生成，稀有度选项带 tone 色阶。

**选中状态与槽位（346-359、851-880、2255-2345）**
临时选中数组 `tempSelectedIds` 由 `selectedCharIds` 初始化，长度即 `maxSlots`（默认 3）。落槽时先做「同 id 已在其他槽」去重，然后写入并 `setTimeout(() => onSave(...))`（注释：延迟保存避免父组件重渲染导致 Modal.Body 丢失滚动），随后弹出 `settings.characters.pin_success` 成功提示 3 秒。移槽采用 `splice + push("")`（char-select.tsx:874-880：删除位后整体前移并尾部补空串）。槽位栏独立于滚动区，展示头像、名称、`common.slot` 序号与移除按钮。

**拖拽换槽（224-246、440-453、454-531、2266-2270、2531-2557）**
不使用 HTML5 DnD，而是 mousedown 后在 document 上挂 mousemove/mouseup：位移 <5px 视为点击（转开详情，`isDraggingRef` 在 `OperatorCard` 内也做二次判定并阻止 onClick）；移动中实时用 `getBoundingClientRect` 命中 `slotRefs` 中的槽位并高亮 `dragOverSlot`；mouseup 时命中且非原槽则 `handleDropOnSlot`。`dragPos` 驱动跟随鼠标的 ghost（头像 + 名字）。

**视图切换与状态重置（567-592、644-651、1146-1170、2479-2483）**
`viewMode` 为 `list | detail`。打开弹窗时全量重置（选中项、视图、`initialCharId`、成功提示、筛选、Wiki 状态）。`enteredDetailFromCard` 标记详情是否由卡片点入：卡片点入时右上角关闭按钮执行 `onClose()` 关整个弹窗，否则仅回列表（1147-1154）。

**数据获取与缓存（594-642、793-849、27-28）**
- Wiki 详情：`useLayoutEffect`（绘制前同步置 loading，避免闪烁）→ `getConfig("wiki_detail_preload")` → `roleDataService.getWikiItemDetail(roleId, wikiItemId)`；`wikiItemId` 为 `0` 时跳过；`cancelled` 标记防竞态；失败走 `logError`。
- 图片：`gridAvatarPaths + detailImagePaths` 交给 `useImageRequest` 批量预取（经 imageCacheManager 转 blob）。
- 该文件自身无任何直接 `invoke()`；数据层缓存由 `roleDataService` 的 `queryCache`（Map<key, Promise>）负责，同一 roleId+apiName+paths 只发一次 IPC。

**与后端交互（间接）**
`roleDataService.getWikiItemDetail` → `queryData(roleId, 'char_wiki_detail', [itemId])` → `invoke('query_role_data', { roleId, apiName, paths })`（roleDataService.ts:83、:206）；`getConfig('wiki_detail_preload')` → `invoke('get_config', { key })`（configService.ts:11，失败回退 localStorage）。

**Wiki/潜能 详情渲染（1708-2233）**
非潜能条目走 `getWikiRenderedBlocks(wikiDetail, name, skillLevel, type, talentRank)` 产出 text/materials 等块：text 块按 heading3/正文区分，正文支持 `\n` 拆行与 bold/underline/color span；materials 块跳过；数值块渲染 label + value → nextValue 与 delta chip（含单位提取，MAX 标记）。潜能条目改用 `getPotentialSegments(contentDoc)` 的富文本段。技能等级来自 `charItem.userSkills[sel.id].level`（默认 1，满级 12），展示 `GlassMeter` 进度与「离满级还差 N 级」；`talentRank` 通过剥离 `·α/一/数字` 后缀比较同名天赋序列计算（1720-1755）。空数据显示「暂无 Wiki 数据」。

**UI 区块**
顶部成功浮窗（893-905，`z-[10003]`）；`CustomModal size="xl" height="fixed"`（907）；detail 视图为 35% 立绘 + 65% 信息栏 + 52% 右侧抽屉（1196-1216、1219-1227、1675-1685，`right` 0/-52% 过渡 300ms）；list 视图为 header + 槽位栏 + 筛选区 + 网格；返回顶部按钮与拖拽 ghost 也在 `CustomModal` 内部（2498、2531）。

**备注**
- **invoke 命令名**：本文件 0 处直接 `invoke(...)`。间接命令仅两个：`query_role_data`、`get_config`。
- **配置键**：`wiki_detail_preload`（char-select.tsx:614）。
- **i18n key 前缀**：`filters.`（profession/all_professions/rarity/all_rarities/property/all_properties/weapon/all_weapons/mainAttr/all_mainAttrs/subAttr/all_subAttrs）、`common.`（slot/remove/clear/no_results_found）、`settings.characters.`（pin_success）、`card.`（title）。注意：`card:title` 不在全局 `src/locales/{zh,en}/translation.json`（其中无 `card` 顶层键），而是由 `src/components/cards/registry/loader.ts:54` 动态 `addResourceBundle(lang, 'card', ...)` 注入，具体 key 来自 `src/components/cards/character-list/locales/{zh,en}.json` 的 `title`；`common.remove` 在全局翻译中缺失（代码内有 `|| "Remove"` 兜底）。
- **与 `src/components/cards/character-list/char-select-modal.tsx` 的关系：高度重复实现（近乎整份拷贝后各自演化）**。两文件共享同名符号与结构：`SKILL_BG_COLORS`、`SKILL_BG_CIRCLE`、`ICON_BASE`、`RARITY_ICON_URL`、`rarityTone`、`FloatSelect`、`OperatorCard`、`rarityLineColorLocal`、`CharSelectModal`，以及同样的 `potentialData`/Wiki 加载/筛选区/网格布局；副本（3171 行、155KB）更大且为**实际被引用版本**（`pages/characters.tsx:13`、`character-list/index.tsx:8` 均 import 它），本文件（2561 行、118KB）**没有任何 import 引用**，属未挂载的冗余实现。此外 `src/pages/characters.tsx:58/192` 还内联了第三份私有 `FloatSelect`/`OperatorCard`，即同 UI 共三处重复。
