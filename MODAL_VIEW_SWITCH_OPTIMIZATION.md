# Modal 视图切换优化 - 列表与详情同屏显示

## 问题

之前点击角色卡片会打开一个新的嵌套 Modal，导致：

1. 双层 Modal 叠加，视觉混乱
2. 需要关闭两个 Modal 才能返回
3. 用户体验不佳

## 解决方案

在同一个 Modal 中实现视图切换（列表视图 ↔ 详情视图），而不是打开嵌套 Modal。

## 实现细节

### 1. 状态管理

添加 `viewMode` 状态来控制当前显示的视图：

```typescript
const [viewMode, setViewMode] = useState<"list" | "detail">("list");
const [detailCharId, setDetailCharId] = useState<string | null>(null);
```

### 2. Header 动态切换

根据 `viewMode` 显示不同的标题：

```tsx
<CustomModalHeader onClose={() => {
  if (viewMode === 'detail') {
    // 从详情页返回列表页
    setViewMode('list');
    setDetailCharId(null);
  } else {
    // 从列表页关闭 Modal
    onClose();
  }
}}>
  {viewMode === 'list' ? (
    // 列表视图标题
    <div className="flex items-center justify-between w-full">
      <h2>Select Characters (Max {MAX_SELECTION})</h2>
      <span className="text-sm text-muted">
        {tempSelectedIds.length} / {MAX_SELECTION} selected
      </span>
    </div>
  ) : (
    // 详情视图标题（显示角色头像和信息）
    <div className="flex items-center gap-3">
      <img src={...} className="w-16 h-16 rounded-lg" />
      <div>
        <h2 className="text-xl font-bold">{character.name}</h2>
        <p className="text-sm text-muted">{rarity}★ {profession}</p>
      </div>
    </div>
  )}
</CustomModalHeader>
```

### 3. Body 内容切换

使用条件渲染显示不同视图：

```tsx
<CustomModalBody>
  {viewMode === 'list' ? (
    // 列表视图：角色选择列表
    <div className="space-y-2">
      {sortedCharacters.map((char) => (
        // 角色卡片
      ))}
    </div>
  ) : (
    // 详情视图：角色详细信息
    detailCharId && (
      <div className="space-y-6">
        {/* Skills Section */}
        {/* Talents Section */}
        {/* Info Section */}
      </div>
    )
  )}
</CustomModalBody>
```

### 4. Footer 条件显示

只在列表视图显示确认按钮：

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
        Confirm ({tempSelectedIds.length})
      </Button>
    </CustomModalFooter>
  );
}
```

### 5. 导航逻辑

#### 从列表进入详情

```tsx
onClick={() => {
  setDetailCharId(charData.id);
  setViewMode('detail');
}}
```

#### 从详情返回列表

```tsx
onClose={() => {
  if (viewMode === 'detail') {
    setViewMode('list');
    setDetailCharId(null);
  } else {
    onClose();
  }
}}
```

## 技术要点

### 1. 单一 Modal 原则

- ✅ 只使用一个 Modal 组件
- ✅ 通过状态控制内部视图切换
- ❌ 避免嵌套 Modal

### 2. 状态同步

- `viewMode` 和 `detailCharId` 必须同步更新
- 返回列表时清空 `detailCharId`

### 3. 用户体验

- ESC 键或点击关闭按钮都能正确返回
- 详情页不显示确认按钮，避免误操作
- 平滑的视图切换动画

### 4. 代码复用

直接在 `char-select-modal.tsx` 中内联详情视图代码，而不是导入 `CharacterDetailModal` 组件，原因：

- 避免组件嵌套
- 更好的状态控制
- 更灵活的布局调整

## 预期效果

### 修复前

```
┌─────────────────────┐
│ 角色选择 Modal       │
│ ┌─────────────────┐ │
│ │ 角色详情 Modal   │ │ ← 嵌套 Modal
│ │                 │ │
│ └─────────────────┘ │
└─────────────────────┘
```

### 修复后

```
┌─────────────────────┐
│ 角色选择/详情 Modal  │
│                     │
│ [列表视图]          │ ← 点击角色
│ ↓                   │
│ [详情视图]          │ ← 点击返回
│ ↓                   │
│ [列表视图]          │
└─────────────────────┘
```

## 相关文件

- `src/components/char-select-modal.tsx` - 主要修改文件

## 优势对比

| 特性       | 嵌套 Modal         | 视图切换         |
| ---------- | ------------------ | ---------------- |
| 视觉层次   | 混乱（双层）       | 清晰（单层）     |
| 关闭操作   | 需要关闭两次       | 只需一次返回     |
| 状态管理   | 复杂（两个 Modal） | 简单（一个状态） |
| 动画效果   | 可能冲突           | 流畅统一         |
| 代码复杂度 | 高                 | 中等             |
| 用户体验   | 较差               | 优秀             |

## 最佳实践

**规则**：在需要展示详情的场景中，优先使用视图切换而非嵌套 Modal。

```tsx
// ✅ 推荐：视图切换
const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');

<Modal>
  {viewMode === 'list' ? <ListView /> : <DetailView />}
</Modal>

// ❌ 不推荐：嵌套 Modal
<Modal>
  <ListView />
  {selectedItem && <DetailModal />}
</Modal>
```
