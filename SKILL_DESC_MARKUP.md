# 技能描述富文本标记解析

## 标记格式

### 1. `<@ba.xxx>文本</>` - 属性/伤害类型标记（带图标）

用于显示元素属性、伤害类型等，通常带有对应的图标和颜色。

| 标记        | 含义             | 示例                                  |
| ----------- | ---------------- | ------------------------------------- |
| `@ba.cryst` | 寒冷伤害         | `<@ba.cryst>寒冷伤害</>`              |
| `@ba.pulse` | 电磁伤害         | `<@ba.pulse>电磁伤害</>`              |
| `@ba.fire`  | 灼热伤害         | `<@ba.fire>灼热伤害</>`               |
| `@ba.key`   | 关键词/机制      | `<@ba.key>水龙卷</>`                  |
| `@ba.vup`   | 数值提升（绿色） | `<@ba.vup>+15%</>`                    |
| `@ba.poise` | 失衡值           | `<@ba.poise>18点失衡</>`              |
| `@ba.info`  | 提示信息         | `<@ba.info>水龙卷伤害视为战技伤害</>` |

### 2. `<#ba.xxx>文本</>` - 状态/效果标记（高亮颜色）

用于显示状态效果、特殊动作等，使用特定颜色高亮。

| 标记               | 含义        | 推测颜色  |
| ------------------ | ----------- | --------- |
| `#ba.lastcombo`    | 连携技/重击 | 金色/橙色 |
| `#ba.crystinflict` | 寒冷附着    | 蓝色      |
| `#ba.pulseinflict` | 电磁附着    | 紫色      |
| `#ba.spellvul`     | 法术脆弱    | 粉色      |
| `#ba.spellburst`   | 法术爆发    | 紫色      |
| `#ba.consume`      | 消耗        | 红色      |
| `#ba.conduct`      | 导电        | 黄色      |
| `#ba.return`       | 返还        | 绿色      |
| `#ba.speedup`      | 加速        | 绿色      |
| `#ba.slow`         | 缓速        | 蓝色      |
| `#ba.shield`       | 护盾        | 蓝色      |
| `#ba.statuslevel`  | 异常等级    | 橙色      |

### 3. `<@tips.xxx>文本</>` - 提示标记

用于装备描述中的特殊提示。

| 标记           | 含义                  |
| -------------- | --------------------- |
| `@tips.purple` | 紫色提示（稀有/特殊） |
| `@tips.orange` | 橙色提示（重要）      |

## 前端渲染建议

### 方案 1：正则表达式替换

```typescript
function parseSkillDesc(text: string): string {
  // 替换 <@ba.xxx>文本</> 为带图标的 span
  text = text.replace(
    /<@ba\.(\w+)>(.*?)<\/>/g,
    '<span class="ba-attr ba-$1" data-type="$1">$2</span>',
  );

  // 替换 <#ba.xxx>文本</> 为高亮 span
  text = text.replace(
    /<#ba\.(\w+)>(.*?)<\/>/g,
    '<span class="ba-highlight ba-$1" data-type="$1">$2</span>',
  );

  // 替换 <@tips.xxx>文本</>
  text = text.replace(
    /<@tips\.(\w+)>(.*?)<\/>/g,
    '<span class="tips-$1">$2</span>',
  );

  return text;
}
```

### 方案 2：CSS 样式定义

```css
/* 属性标记 - 带图标 */
.ba-attr {
  font-weight: bold;
  padding: 0 2px;
}

.ba-cryst {
  color: #6cb4ee;
} /* 寒冷 - 浅蓝 */
.ba-pulse {
  color: #9b59d0;
} /* 电磁 - 紫色 */
.ba-fire {
  color: #e74c3c;
} /* 灼热 - 红色 */
.ba-key {
  color: #f39c12;
} /* 关键词 - 橙色 */
.ba-vup {
  color: #2ecc71;
} /* 提升 - 绿色 */

/* 高亮标记 */
.ba-highlight {
  font-weight: bold;
}

.ba-lastcombo {
  color: #f1c40f;
} /* 连携 - 金色 */
.ba-crystinflict {
  color: #3498db;
} /* 寒冷附着 - 蓝色 */
.ba-pulseinflict {
  color: #9b59d0;
} /* 电磁附着 - 紫色 */
.ba-conduct {
  color: #f39c12;
} /* 导电 - 橙色 */
.ba-shield {
  color: #3498db;
} /* 护盾 - 蓝色 */
```

### 方案 3：React 组件

```tsx
interface SkillDescProps {
  description: string;
}

export function SkillDesc({ description }: SkillDescProps) {
  const parts = parseMarkup(description);

  return (
    <div className="skill-description">
      {parts.map((part, index) =>
        part.type === "text" ? (
          <span key={index}>{part.content}</span>
        ) : (
          <span key={index} className={`ba-${part.prefix}-${part.tag}`}>
            {part.content}
          </span>
        ),
      )}
    </div>
  );
}
```

## 完整标记列表（从 JSON 中提取）

### @ba. 前缀（属性/图标）

- cryst, pulse, fire, key, vup, poise, info

### #ba. 前缀（状态/高亮）

- lastcombo, crystinflict, pulseinflict, spellvul, spellburst,
- consume, conduct, return, speedup, slow, shield, statuslevel

### @tips. 前缀（提示）

- purple, orange

## 注意事项

1. **参数占位符**：描述中可能包含 `{param:0}` 这样的占位符，需要从 `descParams` 或 `descLevelParams` 中获取实际值进行替换
2. **换行符**：描述中使用 `\n` 表示换行，需要转换为 `<br/>` 或保持原样（取决于 CSS）
3. **嵌套标记**：目前未观察到嵌套标记，但需要处理这种情况
4. **未知标记**：如果遇到未定义的标记，应该保留原文本或使用默认样式
