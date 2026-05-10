# 天赋等级过滤修复总结

## 问题

天赋列表显示了所有等级的天赋（如"肝胆相照"显示2次，"呼风唤浪"显示2次），而不是只显示当前激活的等级。

## 原因分析

1. JSON 中 `combatTalents`、`abilityTalents`、`cultivationTalents` 数组包含了**所有等级**的天赋
2. 每个天赋有唯一的 `id`，例如：
   - `chr_0027_tangtang_passive_skill_0_2` - 等级2
   - `chr_0027_tangtang_passive_skill_0_1` - 等级1
3. 当前激活的天赋 ID 存储在 `talent` 字段中：
   - `latestPassiveSkillNodes` - 战斗天赋
   - `attrNodes` - 能力天赋
   - `latestSpaceshipSkillNodes` - 培养天赋

## 解决方案

### 1. 更新 TypeScript 类型定义

**文件**: `src/types/charDetail.ts`

添加 `TalentNodes` 接口和 `talent` 字段：

```typescript
export interface CharacterItem {
  charData: CharacterData;
  id: string;
  level?: number;
  evolvePhase?: number;
  potentialLevel?: number;
  userSkills?: any;
  bodyEquip?: any;
  talent?: TalentNodes; // 当前激活的天赋节点
}

export interface TalentNodes {
  latestBreakNode: string;
  attrNodes: string[]; // 能力天赋节点 ID
  latestPassiveSkillNodes: string[]; // 战斗天赋节点 ID
  latestFactorySkillNodes: string[]; // 制造天赋节点 ID
  latestSpaceshipSkillNodes: string[]; // 培养天赋节点 ID
}
```

### 2. 修改 CharacterDetailModal 组件

**文件**: `src/components/character-detail-modal.tsx`

#### 添加 props

```typescript
interface CharacterDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  character: CharacterData;
  characterItem?: CharacterItem; // 包含 talent 信息
}
```

#### 添加过滤逻辑

```typescript
// 过滤出当前激活的战斗天赋
const activeCombatTalents = character.combatTalents.filter((talent) => {
  const activeNodes = characterItem?.talent?.latestPassiveSkillNodes || [];
  return activeNodes.includes(talent.id);
});

// 过滤出当前激活的能力天赋
const activeAbilityTalents = character.abilityTalents.filter((talent) => {
  const activeNodes = characterItem?.talent?.attrNodes || [];
  return activeNodes.includes(talent.id);
});

// 过滤出当前激活的培养天赋
const activeCultivationTalents = (character.cultivationTalents || []).filter(
  (talent) => {
    const activeNodes = characterItem?.talent?.latestSpaceshipSkillNodes || [];
    return activeNodes.includes(talent.id);
  },
);
```

#### 使用过滤后的列表

```tsx
{
  activeCombatTalents.map((talent) => (
    <div key={talent.id} className="...">
      {/* 天赋内容 */}
    </div>
  ));
}
```

### 3. 修改调用处传递完整数据

**文件**: `src/components/char-select-modal.tsx`

添加辅助函数：

```typescript
// Get full character item by ID (including talent info)
const getCharItemById = (id: string) => {
  return charDetail.chars.find((c) => c.charData.id === id);
};
```

传递完整数据：

```tsx
<CharacterDetailModal
  isOpen={!!detailCharId}
  onClose={() => setDetailCharId(null)}
  character={getCharById(detailCharId)!}
  characterItem={getCharItemById(detailCharId)} // ✅ 传递完整数据
/>
```

## 预期效果

### 修复前

```
Talents
├── 肝胆相照 (等级2)
├── 呼风唤浪 (等级2)
├── 肝胆相照 (等级1) ❌ 重复
└── 呼风唤浪 (等级1) ❌ 重复
```

### 修复后

```
Talents
├── 肝胆相照 (等级2) ✅ 只显示当前等级
└── 呼风唤浪 (等级2) ✅ 只显示当前等级
```

## 技术要点

1. **向后兼容**: `characterItem` 是可选参数，如果未传递则显示所有天赋
2. **空值处理**: 使用 `|| []` 确保即使 `talent` 字段不存在也不会报错
3. **ID 匹配**: 通过天赋的 `id` 与激活节点列表进行精确匹配
4. **类型安全**: TypeScript 类型定义确保数据结构正确

## 相关文件

- `src/types/charDetail.ts` - 类型定义
- `src/components/character-detail-modal.tsx` - 详情模态框组件
- `src/components/char-select-modal.tsx` - 角色选择模态框
