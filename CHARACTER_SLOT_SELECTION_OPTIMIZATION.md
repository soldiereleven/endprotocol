# 角色选择交互优化 - 槽位选择模式

## 问题

之前的复选框多选方式不够直观，用户无法清楚地看到三个槽位和当前已选的干员。

## 解决方案

改为"选择按钮 + 槽位选择"的交互模式：

1. 每个角色卡片右边显示"Select"按钮
2. 点击后显示三个槽位视图
3. 用户点击槽位来替换/填充
4. 即时生效，无需额外确认

## 实现细节

### 1. 状态管理

添加新的状态和视图模式：

```typescript
const [viewMode, setViewMode] = useState<"list" | "detail" | "select-slot">(
  "list",
);
const [selectingCharId, setSelectingCharId] = useState<string | null>(null);
```

**三种视图模式**：

- `list` - 角色列表
- `detail` - 角色详情
- `select-slot` - 槽位选择

### 2. 列表视图改造

#### 移除复选框

```tsx
// ❌ 之前
<Checkbox
  isSelected={isSelected}
  onChange={() => handleToggle(charData.id)}
/>

// ✅ 现在
<Button
  size="sm"
  variant="primary"
  onPress={() => {
    setSelectingCharId(charData.id);
    setViewMode('select-slot');
  }}
>
  Select
</Button>
```

#### 操作按钮组

每个角色卡片右侧显示两个按钮：

- **Details** - 查看角色详情（ghost 样式）
- **Select** - 选择槽位（primary 样式）

### 3. 槽位选择视图

#### 三列网格布局

```tsx
<div className="grid grid-cols-3 gap-4">
  {[0, 1, 2].map((slotIndex) => (
    <div
      key={slotIndex}
      className="relative p-4 rounded-lg border-2 cursor-pointer"
      onClick={() => handleSlotSelect(slotIndex)}
    >
      {/* Slot Number */}
      <div className="absolute top-2 left-2">
        Slot {slotIndex + 1}
      </div>

      {/* Character or Empty */}
      {currentChar ? (
        // 显示当前角色
      ) : (
        // 显示空槽位
      )}
    </div>
  ))}
</div>
```

#### 槽位状态

- **已有角色**：显示头像、名称、星级、职业
- **当前选中**：高亮边框 + "Current" 标签
- **空槽位**：显示 "+" 图标和 "Empty" 文字

#### 视觉反馈

```tsx
className={`... ${
  currentCharId === selectingCharId
    ? 'border-primary bg-primary/10'  // 当前角色高亮
    : 'border-separator hover:border-primary/50'  // 其他槽位
}`}
```

### 4. 槽位选择逻辑

```typescript
const handleSlotSelect = (slotIndex: number) => {
  if (!selectingCharId) return;

  const newSelectedIds = [...tempSelectedIds];
  newSelectedIds[slotIndex] = selectingCharId; // 替换指定槽位
  setTempSelectedIds(newSelectedIds);
  setViewMode("list"); // 返回列表
  setSelectingCharId(null); // 清空选择状态
};
```

**特点**：

- ✅ 即时生效，无需确认按钮
- ✅ 可以覆盖已有角色
- ✅ 可以填充空槽位
- ✅ 自动返回列表视图

### 5. Header 动态切换

根据视图模式显示不同的标题：

```tsx
{
  viewMode === "list" ? (
    // 列表视图：显示选择计数
    <h2>Select Characters (Max {MAX_SELECTION})</h2>
  ) : viewMode === "detail" ? (
    // 详情视图：显示角色信息
    <h2>{character.name}</h2>
  ) : (
    // 槽位选择：显示操作提示
    <h2>Select Slot for {character.name}</h2>
  );
}
```

### 6. Footer 条件显示

只在列表视图显示确认/取消按钮：

```tsx
{
  viewMode === "list" && (
    <CustomModalFooter>
      <Button variant="outline" onPress={onClose}>
        Cancel
      </Button>
      <Button
        variant="primary"
        onPress={() => {
          onSave(tempSelectedIds);
          onClose();
        }}
      >
        Confirm ({count})
      </Button>
    </CustomModalFooter>
  );
}
```

## 用户操作流程

### 流程 1：选择新角色

```
1. 用户在列表中找到角色
2. 点击 "Select" 按钮
3. 进入槽位选择视图
4. 点击空槽位或已有角色的槽位
5. 自动返回列表，角色已添加到该槽位
```

### 流程 2：替换已有角色

```
1. 用户想替换 Slot 2 的角色
2. 在列表中找到新角色
3. 点击 "Select" 按钮
4. 点击 Slot 2（会高亮显示当前角色）
5. 自动替换，返回列表
```

### 流程 3：查看详情

```
1. 点击角色头像或 "Details" 按钮
2. 查看技能、天赋、立绘
3. 点击关闭按钮返回列表
```

## 技术要点

### 1. 数组索引作为槽位 ID

```typescript
// tempSelectedIds 是一个长度为 3 的数组
// 索引 0, 1, 2 对应 Slot 1, 2, 3
const tempSelectedIds = ["char1", "char2", ""]; // Slot 3 为空
```

### 2. 可选链操作符

```typescript
// 安全访问可能为 null 的值
getCharById(selectingCharId)?.name;
```

### 3. 条件渲染

```tsx
{
  viewMode === "list" ? (
    <ListView />
  ) : viewMode === "detail" ? (
    <DetailView />
  ) : (
    <SlotSelectionView />
  );
}
```

### 4. 网格布局

```css
grid grid-cols-3 gap-4
```

创建响应式的三列布局，自动适配不同屏幕宽度。

## 预期效果

### 列表视图

```
┌──────────────────────────────────────┐
│ Avatar │ Name ★★ │ Details │ Select │
├──────────────────────────────────────┤
│ Avatar │ Name ★★ │ Details │ Select │
└──────────────────────────────────────┘
```

### 槽位选择视图

```
┌─────────┬─────────┬─────────┐
│ Slot 1  │ Slot 2  │ Slot 3  │
│ [Avatar]│ [Avatar]│   +     │
│  Name   │  Name   │  Empty  │
│ Current │         │         │
└─────────┴─────────┴─────────┘
```

## 优势对比

| 特性       | 复选框多选     | 槽位选择     |
| ---------- | -------------- | ------------ |
| 直观性     | 一般           | 优秀         |
| 槽位可见性 | 不可见         | 清晰显示     |
| 替换操作   | 需先取消再选择 | 直接点击替换 |
| 学习成本   | 低             | 低           |
| 操作步数   | 多步           | 两步         |
| 误操作风险 | 中             | 低           |

## 相关文件

- `src/components/char-select-modal.tsx` - 主要修改文件

## 最佳实践

**规则**：当需要管理固定数量的槽位时，使用可视化的槽位选择界面比复选框更直观。

```tsx
// ✅ 推荐：可视化槽位
<div className="grid grid-cols-3">
  {slots.map((slot) => (
    <SlotCard {...slot} />
  ))}
</div>;

// ❌ 不推荐：抽象的复选框
{
  items.map((item) => <Checkbox value={item.id} />);
}
```
