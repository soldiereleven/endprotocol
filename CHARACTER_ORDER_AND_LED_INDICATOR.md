# 角色卡片顺序优化与 LED 指示灯

## 完成的改进

### 1. 卡片展示顺序与选择顺序一致

**问题**：卡片显示的角色顺序与用户在 Slot 中选择的顺序不一致。

**原因**：之前使用 `filter` 方法，按照 `charDetail.chars` 的原始顺序显示，而不是按照 `selectedCharIds` 的顺序。

**修复**：改用 `map` 方法，严格按照 `selectedCharIds` 的顺序获取角色。

```typescript
// ❌ 之前：按原始数据顺序
const selectedCharacters =
  charDetail?.chars
    .filter((c) => selectedCharIds.includes(c.charData.id) && c.charData.id)
    .slice(0, 3) || [];

// ✅ 现在：按选择顺序
const selectedCharacters = selectedCharIds
  .map((id) => charDetail?.chars.find((c) => c.charData.id === id))
  .filter((c): c is CharacterItem => c !== undefined)
  .slice(0, 3);
```

**效果**：

- ✅ Slot 0 的角色显示在最左边
- ✅ Slot 1 的角色显示在中间
- ✅ Slot 2 的角色显示在最右边
- ✅ 完全符合用户的选择顺序

---

### 2. Modal 列表中已 Pin 的角色置顶

**排序规则**（优先级从高到低）：

1. **已 Pin 的角色** - 排在最前面
2. **稀有度** - 从高到低（6★ > 5★ > 4★）
3. **名称** - 字母顺序（A-Z）

```typescript
// Sort characters: pinned first, then by rarity (desc), then name (asc)
const sortedCharacters = [...charDetail.chars].sort((a, b) => {
  const aPinned = tempSelectedIds.includes(a.charData.id);
  const bPinned = tempSelectedIds.includes(b.charData.id);

  // Pinned characters come first
  if (aPinned && !bPinned) return -1;
  if (!aPinned && bPinned) return 1;

  // Then sort by rarity (desc)
  const rarityA = parseInt(a.charData.rarity.value) || 0;
  const rarityB = parseInt(b.charData.rarity.value) || 0;

  if (rarityB !== rarityA) {
    return rarityB - rarityA;
  }

  // Finally by name (asc)
  return a.charData.name.localeCompare(b.charData.name);
});
```

**示例**：

```
已 Pin 的角色:
├─ Amiya (6★) - ACTIVE ✓
├─ SilverAsh (6★) - ACTIVE ✓
└─ Exusiai (5★) - ACTIVE ✓

未 Pin 的角色:
├─ Surtr (6★)
├─ Blaze (6★)
└─ ...
```

---

### 3. Account 页面同款 LED 指示灯

#### 3.1 绿色 LED（已 Pin 的角色）

```tsx
<div className="relative flex-shrink-0">
  {/* 主灯 */}
  <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] dark:shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
  {/* 脉冲动画 */}
  <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-400 animate-ping opacity-20" />
</div>
```

**视觉效果**：

- ✅ 绿色圆形指示灯（12x12px）
- ✅ 发光阴影效果
- ✅ 脉冲动画（ping）
- ✅ 支持深色/浅色模式

#### 3.2 灰色 LED（未 Pin 的角色）

```tsx
<div className="relative flex-shrink-0">
  <div className="w-3 h-3 rounded-full bg-gray-400 dark:bg-gray-500" />
</div>
```

**视觉效果**：

- ✅ 灰色圆形指示灯
- ✅ 无动画
- ✅ 表示非活跃状态

---

### 4. ACTIVE 标签

**样式**：与 Account 页面完全一致

```tsx
{
  tempSelectedIds.includes(charData.id) && (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold text-green-600 dark:text-green-400 tracking-wider">
      ACTIVE
    </span>
  );
}
```

**位置**：紧跟在星级徽章后面

**示例显示**：

```
[LED] [头像] Amiya [6★] [ACTIVE]
      术师 · 火焰
```

---

## 📊 修改的文件

### 1. `src/components/cards/character-list-card.tsx`

**修改位置**：第 103-107 行

**修改内容**：

- 从 `filter` 改为 `map`
- 保持 `selectedCharIds` 的顺序
- 添加类型守卫确保类型安全

---

### 2. `src/components/char-select-modal.tsx`

#### 修改 1：排序逻辑（第 41-64 行）

- 添加已 Pin 角色的优先判断
- 保持原有的稀有度和名称排序

#### 修改 2：LED 指示灯（第 203-216 行）

- 在角色列表项开头添加 LED 指示灯
- 根据是否 Pin 显示不同颜色
- 已 Pin：绿色 + 脉冲动画
- 未 Pin：灰色

#### 修改 3：ACTIVE 标签（第 228-234 行）

- 在角色名称和星级后添加 ACTIVE 标签
- 仅对已 Pin 的角色显示
- 绿色文字，加粗，小字号

---

## 🎯 用户体验提升

### 视觉反馈

- ✅ LED 指示灯清晰标识已 Pin 的角色
- ✅ ACTIVE 标签明确显示激活状态
- ✅ 脉冲动画吸引注意力
- ✅ 绿色/灰色对比明显

### 交互体验

- ✅ 已 Pin 的角色自动置顶，方便管理
- ✅ 卡片顺序与 Slot 选择一致，符合直觉
- ✅ 一眼就能看出哪些角色已被选择

### 一致性

- ✅ 与 Account 页面的 LED 指示灯风格统一
- ✅ 相同的颜色、大小、动画效果
- ✅ 相同的 ACTIVE 标签样式

---

## 💡 技术要点

### 数组排序优先级

```typescript
// 多重条件排序
if (condition1) return -1; // 最高优先级
if (condition2) return -1; // 次高优先级
return defaultSort(); // 默认排序
```

### 类型守卫

```typescript
.filter((c): c is CharacterItem => c !== undefined)
```

确保 TypeScript 知道过滤后的数组不包含 `undefined`。

### CSS 发光效果

```css
shadow-[0_0_8px_rgba(34,197,94,0.6)]
```

使用 Tailwind 的任意值语法创建自定义阴影，模拟 LED 发光效果。

### 脉冲动画

```css
animate-ping opacity-20
```

HeroUI/Tailwind 内置的 ping 动画，创建扩散效果。

---

## 🚀 下一步建议

1. **添加拖放排序** - 允许用户直接拖拽调整 Slot 顺序
2. **添加快速取消** - 点击 LED 或 ACTIVE 标签快速取消 Pin
3. **添加批量操作** - 一键清除所有 Pin
4. **添加快捷键** - 键盘操作提升效率
