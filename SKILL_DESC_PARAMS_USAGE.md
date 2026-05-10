# 技能描述参数替换使用说明

## 参数占位符格式

### 基本格式

```
{parameter_name:format}
```

### 格式说明

| 格式           | 含义     | 示例                | 结果 |
| -------------- | -------- | ------------------- | ---- |
| `{poise:0}`    | 整数     | `"18"` → `18`       | 18   |
| `{atk_up:0%}`  | 百分比   | `"0.15"` → `15%`    | 15%  |
| `{ratio:0.00}` | 两位小数 | `"0.3456"` → `0.35` | 0.35 |
| `{value:0.0}`  | 一位小数 | `"1.234"` → `1.2`   | 1.2  |

## 参数来源

### 1. 技能参数

从技能对象的 `descParams` 或 `descLevelParams[level].params` 获取：

```typescript
// 技能数据结构
interface Skill {
  desc: string;                    // 描述文本（包含占位符）
  descParams: Record<string, string>;          // 基础参数
  descLevelParams: {               // 按等级的参数
    [level: string]: {
      level: string;
      params: Record<string, string>;
    };
  };
}

// 使用示例
const skill = character.skills[0];
const currentLevel = 1;  // 当前技能等级

// 优先使用等级参数，如果没有则使用基础参数
const params = skill.descLevelParams?.[currentLevel]?.params || skill.descParams;

<SkillDescription
  description={skill.desc}
  params={params}
/>
```

### 2. 天赋参数

从天赋对象的 `descParams` 获取：

```typescript
interface Talent {
  desc: string;
  descParams?: Record<string, string>;
}

<SkillDescription
  description={talent.desc}
  params={talent.descParams}
/>
```

### 3. 装备套装参数

从装备套装的 `skillDescParams` 获取：

```typescript
interface EquipSuit {
  skillDesc: string;
  skillDescParams: Record<string, string>;
}

<SkillDescription
  description={suit.skillDesc}
  params={suit.skillDescParams}
/>
```

## 完整示例

### 示例 1：技能描述

```tsx
// JSON 数据
{
  "desc": "造成<@ba.cryst>{damage:0}</>点寒冷伤害，恢复<@ba.vup>{heal:0}</>点生命值",
  "descParams": {
    "damage": "1500",
    "heal": "300"
  }
}

// 渲染结果
// "造成 1500 点寒冷伤害，恢复 300 点生命值"
// （数字带有颜色和加粗效果）
```

### 示例 2：百分比参数

```tsx
// JSON 数据
{
  "desc": "攻击力提升<@ba.vup>+{atk_up:0%}</>",
  "descParams": {
    "atk_up": "0.15"
  }
}

// 渲染结果
// "攻击力提升 +15%"
// （15% 显示为绿色加粗）
```

### 示例 3：多等级技能

```tsx
// 根据当前等级选择参数
const getSkillParams = (skill: Skill, level: number) => {
  // 尝试从等级参数中获取
  const levelParams = skill.descLevelParams?.[level.toString()]?.params;

  if (levelParams) {
    return levelParams;
  }

  // 降级到基础参数
  return skill.descParams;
};

// 使用
const params = getSkillParams(skill, currentLevel);
<SkillDescription description={skill.desc} params={params} />;
```

## 注意事项

1. **参数缺失**：如果占位符中的参数在 params 中不存在，会保留原样 `{param:0}`
2. **非数字值**：如果参数值无法解析为数字，会返回原始字符串
3. **格式化优先级**：
   - 先检查是否以 `%` 结尾（百分比）
   - 再检查是否包含 `.`（小数）
   - 否则作为整数处理

## 测试用例

```typescript
// 测试 formatParamValue 函数
formatParamValue("18", "0")        → "18"
formatParamValue("0.15", "0%")     → "15%"
formatParamValue("1.234", "0.0")   → "1.2"
formatParamValue("0.3456", "0.00") → "0.35"
formatParamValue("abc", "0")       → "abc"  // 非数字
```

## 后续优化建议

1. **自动检测等级**：从 `userSkills` 中读取当前技能等级
2. **缓存参数**：避免重复计算格式化
3. **支持更多格式**：如千分位分隔符、科学计数法等
4. **本地化**：根据不同语言调整数字格式
