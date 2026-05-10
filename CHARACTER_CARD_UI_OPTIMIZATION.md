# 角色卡片 UI 优化与 Pin 功能改进

## 完成的修复

### 1. 修复选择的角色没有在卡片上显示

**问题**：`selectedCharIds` 数组中可能包含空字符串，导致过滤逻辑失败。

**修复**：

```typescript
// 加载时过滤空字符串
const validIds = ids.filter((id) => id && id.trim() !== "");
setSelectedCharIds(validIds);

// 显示时再次过滤
const selectedCharacters =
  charDetail?.chars
    .filter((c) => selectedCharIds.includes(c.charData.id) && c.charData.id)
    .slice(0, 3) || [];
```

**调试日志**：

```typescript
logDebug("Loaded selected char IDs:", ids);
logDebug("Filtered valid IDs:", validIds);
logDebug("Using default IDs:", defaultIds);
```

---

### 2. Select 改为 Pin

将所有 "Select" 相关的文字改为 "Pin"，更符合固定/收藏的语义：

| 位置         | 之前                     | 现在                 |
| ------------ | ------------------------ | -------------------- |
| Modal 标题   | Select Characters        | Pin Characters       |
| 计数文字     | selected                 | pinned               |
| 按钮文字     | Select                   | Pin                  |
| 槽位选择标题 | Select Slot for X        | Pin Slot for X       |
| 说明文字     | place this character     | pin this character   |
| 确认按钮     | Confirm Replace          | Confirm Pin          |
| 提示文字     | Click Confirm to replace | Click Confirm to pin |

---

### 3. 卡片 UI 优化

#### 3.1 移除用户名和等级

**之前**：

```tsx
<h3>{charDetail.base.name}</h3>
<span>Lv.{charDetail.base.level}</span>
```

**现在**：

```tsx
<h3>Characters ({selectedCharacters.length}/3)</h3>
```

只显示当前固定的角色数量，更简洁。

#### 3.2 增大卡片尺寸

```tsx
className = "... min-h-[200px]"; // 最小高度 200px
```

#### 3.3 角色头像更大

```tsx
<div className="grid grid-cols-3 gap-4">  // gap 从 3 增加到 4
```

#### 3.4 添加角色信息覆盖层

```tsx
<div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 rounded-b-lg">
  <p className="text-white text-xs font-semibold truncate">
    {char.charData.name}
  </p>
  <p className="text-white/80 text-[10px]">
    {char.charData.rarity.value}★ {char.charData.profession.value}
  </p>
</div>
```

**效果**：

- 渐变黑色背景
- 白色文字显示角色名称
- 小字显示星级和职业
- 悬停时更清晰

#### 3.5 空槽位显示

```tsx
{
  Array.from({ length: Math.max(0, 3 - selectedCharacters.length) }).map(
    (_, index) => (
      <div className="aspect-square rounded-lg border-2 border-dashed border-separator flex items-center justify-center bg-default-50">
        <span className="text-muted text-sm">Empty</span>
      </div>
    ),
  );
}
```

**效果**：

- 虚线边框
- 灰色背景
- "Empty" 文字提示

---

### 4. 导入路径修复

**问题**：相对路径 `../char-select-modal` 在某些情况下会失败。

**修复**：使用绝对路径

```typescript
import { CharSelectModal } from "@/components/char-select-modal";
```

---

## 技术要点

### 1. 空值过滤

```typescript
// 双重保险：加载时过滤 + 使用时过滤
const validIds = ids.filter((id) => id && id.trim() !== "");

const selectedCharacters = chars.filter(
  (c) => selectedCharIds.includes(c.charData.id) && c.charData.id,
);
```

### 2. 渐变覆盖层

```css
bg-gradient-to-t from-black/70 to-transparent
```

- `to-t` - 从下到上的渐变
- `from-black/70` - 底部 70% 透明度的黑色
- `to-transparent` - 顶部完全透明

### 3. 条件渲染空槽位

```typescript
Math.max(0, 3 - selectedCharacters.length);
```

确保不会出现负数，避免渲染错误。

### 4. 文本截断

```css
truncate  // Tailwind CSS 类，等同于 overflow-hidden text-ellipsis whitespace-nowrap
```

防止长名字溢出卡片。

---

## 视觉效果对比

### 之前

```
┌──────────────────────────────┐
│ Username          Lv.100     │
├──────────────────────────────┤
│ [Avatar] [Avatar] [Avatar]   │
└──────────────────────────────┘
Click to customize characters
```

### 现在

```
┌──────────────────────────────┐
│ Characters (2/3)             │
├──────────────────────────────┤
│ ┌──────┐ ┌──────┐ ┌──────┐  │
│ │      │ │      │ │Empty │  │
│ │ Name │ │ Name │ │      │  │
│ │ 5★ ★│ │ 6★ ★│ │      │  │
│ └──────┘ └──────┘ └──────┘  │
└──────────────────────────────┘
```

**改进**：

- ✅ 更大的头像
- ✅ 角色信息直接显示在头像上
- ✅ 空槽位清晰可见
- ✅ 无冗余信息（用户名、等级）
- ✅ 更现代的 UI 设计

---

## 相关文件

- `src/components/cards/character-list-card.tsx` - 卡片组件优化
- `src/components/char-select-modal.tsx` - Modal 文字更新

## 后续优化建议

### 磁贴式布局（待实现）

1. 使用 `react-grid-layout` 或类似库
2. 支持拖放重新排列卡片
3. 自动对齐和对齐线
4. 管理层级关系（z-index）

### 卡片自定义

1. 用户可以选择显示哪些信息
2. 调整卡片大小
3. 更换主题/颜色

### 性能优化

1. 虚拟滚动（如果卡片很多）
2. 图片懒加载
3. 缓存优化

---

## 最佳实践

**规则 1**：处理数组数据时，始终过滤无效值（空字符串、null、undefined）。

**规则 2**：使用绝对路径导入组件，避免相对路径在不同目录层级下失效。

**规则 3**：UI 文本应该简洁明了，避免冗余信息。

**规则 4**：空状态应该有清晰的视觉提示，而不是留白。

**规则 5**：重要的操作按钮应该使用明确的动词（Pin vs Select）。
