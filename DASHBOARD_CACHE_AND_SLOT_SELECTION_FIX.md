# Dashboard 缓存优化与槽位选择改进

## 完成的修复

### 1. Dashboard 进入时直接读缓存

**问题**：每次进入 Dashboard 都会调用 API 获取角色详情，即使缓存中有数据。

**修复**：修改 `character-list-card.tsx`，只在缓存不存在时才调用 API。

```typescript
// ❌ 之前：每次都检查是否需要刷新
if (!detail || charDetailCache.needsRefresh(roleId)) {
  const result = await invoke("get_char_detail", { roleId });
  // ...
}

// ✅ 现在：只有缓存为空时才调用 API
if (!detail) {
  logDebug("Cache miss, fetching from backend...");
  const result = await invoke("get_char_detail", { roleId });
  // ...
} else {
  logDebug("Using cached character detail");
}
```

**优势**：

- ✅ 快速加载，无网络延迟
- ✅ 减少 API 调用次数
- ✅ 离线也能显示数据
- ✅ 用户需要手动刷新才会更新

---

### 2. 槽位选择交互改进

#### 2.1 选中后高亮边框，等待确认

**之前**：点击槽位立即替换，无法撤销。

**现在**：

1. 点击槽位 → 高亮边框 + "Selected" 标签
2. 点击 "Confirm Replace" → 确认替换
3. 点击 "Cancel" → 取消选择

```typescript
const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);

const handleSlotSelect = (slotIndex: number) => {
  // 只记录选择，不立即替换
  setSelectedSlotIndex(slotIndex);
};

const handleConfirmSlot = () => {
  // 确认后才替换
  const newSelectedIds = [...tempSelectedIds];
  newSelectedIds[selectedSlotIndex] = selectingCharId;
  setTempSelectedIds(newSelectedIds);
  // ...
};
```

**视觉效果**：

- **选中的槽位**：蓝色边框 + 阴影 + "Selected" 标签
- **当前角色的槽位**：灰色 "Current" 标签
- **其他槽位**：正常边框，hover 效果

---

#### 2.2 不允许重复干员

**问题**：同一个角色可以出现在多个槽位中。

**修复**：检测重复并禁止选择。

```typescript
const handleSlotSelect = (slotIndex: number) => {
  if (!selectingCharId) return;

  // 检查是否会在其他槽位产生重复
  const isDuplicate = tempSelectedIds.some(
    (id, idx) => id === selectingCharId && idx !== slotIndex,
  );

  if (isDuplicate) {
    return; // 不允许选择
  }

  setSelectedSlotIndex(slotIndex);
};
```

**视觉效果**：

- **重复的槽位**：黄色边框 + 半透明 + 不可点击
- **提示**：鼠标悬停时显示 `cursor-not-allowed`

---

#### 2.3 修复"当前干员"显示问题

**问题**：替换后没有正确显示哪个槽位是当前角色所在的槽位。

**修复**：区分三种状态：

```typescript
const isCurrentCharSlot = currentCharId === selectingCharId;  // 当前角色在这个槽位
const isSelected = selectedSlotIndex === slotIndex;           // 用户选择了这个槽位

// 显示逻辑
{isCurrentCharSlot && !isSelected && (
  <div className="...">Current</div>  // 当前角色所在槽位（未选中）
)}
{isSelected && (
  <div className="...">Selected</div>  // 用户选中的槽位
)}
```

**状态说明**：

1. **Current** - 角色当前已在这个槽位（灰色标签）
2. **Selected** - 用户选择要替换到的槽位（蓝色标签）
3. **Current + Selected** - 选择当前槽位（只显示 Selected）

---

### 3. UI 改进

#### 槽位卡片样式

```tsx
className={`... ${
  isSelected
    ? 'border-primary bg-primary/10 shadow-lg'        // 选中：蓝色高亮
    : hasDuplicate
    ? 'border-warning bg-warning/10 opacity-50 cursor-not-allowed'  // 重复：黄色警告
    : 'border-separator bg-content1 hover:border-primary/50'       // 正常：默认样式
}`}
```

#### 确认按钮

```tsx
<div className="flex gap-3 justify-center">
  <Button variant="outline" onPress={handleCancel}>
    Cancel
  </Button>
  <Button
    variant="primary"
    isDisabled={selectedSlotIndex === null} // 未选择时禁用
    onPress={handleConfirmSlot}
  >
    Confirm Replace
  </Button>
</div>
```

---

## 用户操作流程

### 流程 1：选择新角色到空槽位

```
1. 在列表中找到角色
2. 点击 "Select" 按钮
3. 进入槽位选择视图
4. 点击空槽位（高亮显示）
5. 点击 "Confirm Replace"
6. 返回列表，角色已添加
```

### 流程 2：替换已有角色

```
1. 在列表中找到新角色
2. 点击 "Select" 按钮
3. 看到 Slot 2 有 "Current" 标签（如果要替换的角色在那里）
4. 点击 Slot 2（显示 "Selected" 标签）
5. 点击 "Confirm Replace"
6. 完成替换
```

### 流程 3：尝试重复选择

```
1. 角色 A 已在 Slot 1
2. 再次选择角色 A
3. Slot 1 显示黄色边框 + 半透明（不可点击）
4. 只能选择其他槽位或取消
```

---

## 技术要点

### 1. 状态管理

```typescript
const [selectingCharId, setSelectingCharId] = useState<string | null>(null);
const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
```

- `selectingCharId` - 正在选择的角色 ID
- `selectedSlotIndex` - 用户选择的槽位索引（待确认）

### 2. 重复检测

```typescript
const isDuplicate = tempSelectedIds.some(
  (id, idx) => id === selectingCharId && idx !== slotIndex,
);
```

使用 `some()` 方法检查数组中是否存在相同的角色 ID（排除当前槽位）。

### 3. 条件渲染

```tsx
{
  isCurrentCharSlot && !isSelected && <CurrentBadge />;
}
{
  isSelected && <SelectedBadge />;
}
```

互斥的条件确保不会同时显示两个标签。

### 4. 按钮禁用

```tsx
<Button isDisabled={selectedSlotIndex === null} onPress={handleConfirmSlot}>
  Confirm Replace
</Button>
```

只有在用户选择了槽位后才能确认。

---

## 相关文件

- `src/components/cards/character-list-card.tsx` - Dashboard 缓存优化
- `src/components/char-select-modal.tsx` - 槽位选择交互改进

## 优势对比

| 特性           | 之前         | 现在              |
| -------------- | ------------ | ----------------- |
| Dashboard 加载 | 每次调用 API | 优先使用缓存      |
| 槽位选择       | 立即替换     | 确认后替换        |
| 重复检测       | 无           | 禁止重复          |
| 当前角色标识   | 不准确       | 清晰显示          |
| 可撤销操作     | 否           | 是（Cancel 按钮） |
| 视觉反馈       | 一般         | 优秀（高亮+标签） |

---

## 最佳实践

**规则 1**：Dashboard 等频繁访问的页面应优先使用缓存，减少 API 调用。

**规则 2**：重要的数据修改操作应该提供确认步骤，避免误操作。

**规则 3**：不允许的数据状态应该在 UI 层面就禁止，而不是提交后再报错。

**规则 4**：清晰的视觉反馈（颜色、标签、阴影）能显著提升用户体验。
