# 技能描述参数解析完整修复总结

## 问题

1. 天赋完全不显示
2. 存在未解析的参数占位符，如 `{100*ignore_fire_resist:0}`

## 根本原因分析

### 问题 1：天赋不显示

- **后端**：`CharacterItem` 结构体缺少 `talent` 字段
- **前端**：过滤逻辑依赖 `characterItem.talent`，但该字段为空

### 问题 2：参数格式复杂

从 JSON 中提取到 **97 种唯一参数格式**：

- 90 个简单参数：`{poise:0}`, `{atk_up:0%}`
- 5 个带数字前缀的参数：`{1-shelterrate:0%}`
- 2 个表达式参数：
  - `{100*ignore_fire_resist:0}` - 乘法
  - `{talent_1+1:0}` - 加法

## 解决方案

### 1. 后端修复 - 添加 talent 字段

**文件**: `src-tauri/src/models/char_detail.rs`

```rust
/// 干员项（API 返回的格式）
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CharacterItem {
    // ... 其他字段
    #[serde(default)]
    pub talent: Option<TalentNodes>,
}

/// 天赋节点信息
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TalentNodes {
    pub latest_break_node: String,
    pub attr_nodes: Vec<String>, // 能力天赋节点 ID
    pub latest_passive_skill_nodes: Vec<String>, // 战斗天赋节点 ID
    pub latest_factory_skill_nodes: Vec<String>, // 制造天赋节点 ID
    pub latest_spaceship_skill_nodes: Vec<String>, // 培养天赋节点 ID
}
```

### 2. 前端类型定义

**文件**: `src/types/charDetail.ts`

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

### 3. 参数解析器增强

**文件**: `src/utils/skillDescParser.tsx`

支持的格式：

#### 格式 1：简单参数

```
{poise:0} → 从 params.poise 获取值
```

#### 格式 2：带数字前缀的参数

```
{1-shelterrate:0%} → 去掉前缀 "1-"，查找 params.shelterrate
```

#### 格式 3：乘法表达式

```
{100*ignore_fire_resist:0} → params.ignore_fire_resist * 100
```

#### 格式 4：加法表达式

```
{talent_1+1:0} → params.talent_1 + 1
```

#### 实现代码

```typescript
function replaceParams(text: string, params: Record<string, string>): string {
  return text.replace(/\{([^}]+?):(.*?)\}/g, (match, fullParamName, format) => {
    let paramName = fullParamName;
    let multiplier = 1;
    let addend = 0;

    // 检查乘法表达式
    const multiplyMatch = paramName.match(/^(\d+(?:\.\d+)?)\*(.+)$/);
    if (multiplyMatch) {
      multiplier = parseFloat(multiplyMatch[1]);
      paramName = multiplyMatch[2];
    }

    // 检查加法表达式
    const addMatch = paramName.match(/^(.+)\+(\d+(?:\.\d+)?)$/);
    if (addMatch) {
      paramName = addMatch[1];
      addend = parseFloat(addMatch[2]);
    }

    // 查找参数（支持去掉数字前缀）
    let value = params[paramName];
    if (value === undefined && paramName.includes("-")) {
      const parts = paramName.split("-");
      if (parts.length > 1 && /^\d+$/.test(parts[0])) {
        const actualParamName = parts.slice(1).join("-");
        value = params[actualParamName];
      }
    }

    if (value === undefined) {
      return match;
    }

    // 应用表达式计算
    const numericValue = parseFloat(value);
    if (!isNaN(numericValue)) {
      const calculatedValue = numericValue * multiplier + addend;
      return formatParamValue(calculatedValue.toString(), format);
    }

    return formatParamValue(value, format);
  });
}
```

### 4. 天赋过滤逻辑

**文件**: `src/components/character-detail-modal.tsx`

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

### 5. 传递完整数据

**文件**: `src/components/char-select-modal.tsx`

```typescript
// 获取完整的 CharacterItem（包含 talent 信息）
const getCharItemById = (id: string) => {
  return charDetail.chars.find(c => c.charData.id === id);
};

// 传递完整数据
<CharacterDetailModal
  isOpen={!!detailCharId}
  onClose={() => setDetailCharId(null)}
  character={getCharById(detailCharId)!}
  characterItem={getCharItemById(detailCharId)} // ✅ 传递完整数据
/>
```

## 预期效果

### 天赋显示

```
Talents
├── 肝胆相照 (等级2) ✅ 只显示当前激活的等级
└── 呼风唤浪 (等级2) ✅ 只显示当前激活的等级
```

### 参数替换

```
战技进军和连携技前线援护的施放过程中获得50%庇护，且更不容易被打断。

造成的伤害+60%。

忽略100点火抗，持续5秒。
```

## 技术要点

1. **向后兼容**: 所有新字段都是 `Option` 类型
2. **空值处理**: 使用 `|| []` 确保不会因缺失数据而崩溃
3. **ID 精确匹配**: 通过天赋 ID 与激活节点列表匹配
4. **表达式计算**: 支持乘法和加法运算
5. **前缀处理**: 自动识别并去掉数字前缀

## 相关文件

- `src-tauri/src/models/char_detail.rs` - Rust 模型定义
- `src/types/charDetail.ts` - TypeScript 类型定义
- `src/utils/skillDescParser.tsx` - 参数解析器
- `src/components/character-detail-modal.tsx` - 详情模态框
- `src/components/char-select-modal.tsx` - 角色选择模态框
