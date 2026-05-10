# 技能描述参数替换 - 修复总结

## 问题

技能描述中的参数占位符（如 `{poise:0}`, `{attack:0%}`）没有被替换为实际数值。

## 原因

在 `character-detail-modal.tsx` 中调用 `SkillDescription` 组件时，没有传递 `params` 参数。

## 修复

### 修改的文件

`src/components/character-detail-modal.tsx`

### 修改内容

#### 1. 技能描述（第 55-60 行）

```tsx
// 修复前
<SkillDescription description={skill.desc} className="text-sm" />

// 修复后
<SkillDescription
  description={skill.desc}
  params={skill.descParams}  // ✅ 添加参数字典
  className="text-sm"
/>
```

#### 2. 天赋描述（第 77-82 行）

```tsx
// 修复前
<SkillDescription description={talent.desc} className="text-sm mt-1" />

// 修复后
<SkillDescription
  description={talent.desc}
  params={talent.descParams}  // ✅ 添加参数字典
  className="text-sm mt-1"
/>
```

## 效果对比

### 修复前

```
普通攻击：
对敌人进行至多4段攻击，造成物理伤害。作为主控干员时，重击会造成{poise:0}点失衡。
```

### 修复后

```
普通攻击：
对敌人进行至多4段攻击，造成[蓝色加粗]物理伤害[/]。作为主控干员时，[金色加粗]重击[/]会造成[蓝色加粗]18[/]点失衡。
```

## 参数来源

### 技能参数

从 JSON 中的 `descParams` 字段获取：

```json
{
  "desc": "造成{poise:0}点失衡",
  "descParams": {
    "poise": "18"
  }
}
```

### 天赋参数

从 JSON 中的 `descParams` 字段获取：

```json
{
  "desc": "攻击力+{attack:0%}",
  "descParams": {
    "attack": "0.15",
    "duration": "10"
  }
}
```

## 格式化规则

| 占位符格式     | 参数值     | 显示结果 | 说明               |
| -------------- | ---------- | -------- | ------------------ |
| `{poise:0}`    | `"18"`     | `18`     | 整数               |
| `{attack:0%}`  | `"0.15"`   | `15%`    | 百分比（自动×100） |
| `{ratio:0.00}` | `"0.3456"` | `0.35`   | 两位小数           |
| `{duration:0}` | `"10"`     | `10`     | 整数               |

## 测试建议

1. 打开角色详情模态框
2. 检查所有技能的描述是否正确显示数值
3. 检查所有天赋的描述是否正确显示数值
4. 验证百分比格式（如 `15%`）和整数格式（如 `18`）都正确显示

## 后续优化

可以考虑的改进：

1. **支持等级参数**：根据 `userSkills` 中的等级，从 `descLevelParams` 中获取对应等级的参数
2. **缓存格式化结果**：避免重复计算
3. **添加动画效果**：数值变化时的过渡动画
4. **本地化数字格式**：根据不同语言使用不同的数字分隔符
