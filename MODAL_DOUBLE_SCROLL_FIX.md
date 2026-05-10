# Modal 双层滚动修复

## 问题

Modal 组件中存在双层滚动条，外层滚动是无用的，影响用户体验。

## 原因分析

### 双层滚动结构

```
CustomModal (max-h-[85vh])
└── CustomModalBody (max-h-[70vh] overflow-y-auto) ← 第一层滚动
    └── ScrollShadow (max-h-[70vh]) ← 第二层滚动（无用）
        └── 内容
```

`CustomModalBody` 已经有 `overflow-y-auto`，再包裹 `ScrollShadow` 会导致：

1. 两层滚动条同时出现
2. 滚动行为不一致
3. 视觉混乱

## 解决方案

移除 `CustomModalBody` 内部的 `ScrollShadow` 包装，让 `CustomModalBody` 自己处理滚动。

### 修改的文件

#### 1. character-detail-modal.tsx

**修改前：**

```tsx
import { ScrollShadow } from "@heroui/react";

<CustomModalBody>
  <ScrollShadow className="max-h-[70vh]">
    <div className="space-y-6">{/* 内容 */}</div>
  </ScrollShadow>
</CustomModalBody>;
```

**修改后：**

```tsx
<CustomModalBody>
  <div className="space-y-6">{/* 内容 */}</div>
</CustomModalBody>
```

#### 2. char-select-modal.tsx

**修改前：**

```tsx
import { ScrollShadow } from "@heroui/react";

<CustomModalBody>
  <ScrollShadow className="max-h-[60vh]">
    <div className="space-y-2">{/* 内容 */}</div>
  </ScrollShadow>
</CustomModalBody>;
```

**修改后：**

```tsx
<CustomModalBody>
  <div className="space-y-2">{/* 内容 */}</div>
</CustomModalBody>
```

## 技术要点

### CustomModalBody 的滚动机制

```tsx
export const CustomModalBody: React.FC<ModalBodyProps> = ({
  children,
  className = "",
}) => {
  return (
    <div className={clsx("px-6 py-4 max-h-[70vh] overflow-y-auto", className)}>
      {children}
    </div>
  );
};
```

- `max-h-[70vh]` - 限制最大高度为视口高度的 70%
- `overflow-y-auto` - 内容超出时自动显示垂直滚动条

### 为什么不需要 ScrollShadow？

1. **功能重复**：`CustomModalBody` 已经提供滚动功能
2. **高度冲突**：两层都设置 `max-h` 导致计算复杂
3. **性能开销**：额外的 DOM 节点和样式计算
4. **用户体验**：单层滚动更流畅、更直观

## 预期效果

### 修复前

```
┌─────────────────────┐
│ Modal Header         │
├─────────────────────┤
│ ║ 内容区域          │ ← 内层滚动
│ ║                   │
│ ║                   │
├─────────────────────┤
│   外层滚动条 → ||   │ ← 外层滚动（无用）
└─────────────────────┘
```

### 修复后

```
┌─────────────────────┐
│ Modal Header         │
├─────────────────────┤
│ 内容区域             │
│                     │
│                     │
│                     │
├─────────────────────┤
│ 滚动条 → |          │ ← 单层滚动（清晰）
└─────────────────────┘
```

## 相关文件

- `src/components/custom-modal.tsx` - Modal 基础组件（包含滚动逻辑）
- `src/components/character-detail-modal.tsx` - 角色详情模态框
- `src/components/char-select-modal.tsx` - 角色选择模态框

## 最佳实践

**规则**：在自定义 Modal 中，只让 `CustomModalBody` 处理滚动，不要在内部再添加滚动容器。

```tsx
// ✅ 正确
<CustomModalBody>
  <div className="space-y-4">
    {/* 内容 */}
  </div>
</CustomModalBody>

// ❌ 错误
<CustomModalBody>
  <ScrollShadow className="max-h-[70vh]">
    <div className="space-y-4">
      {/* 内容 */}
    </div>
  </ScrollShadow>
</CustomModalBody>
```
