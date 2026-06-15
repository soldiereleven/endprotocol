/**
 * 技能描述富文本解析器
 * 将游戏内的标记转换为带样式的 HTML
 */

// 标记颜色映射（根据语义推断）
const TAG_COLORS: Record<string, string> = {
  // @ba. 属性/伤害标记
  cryst: "#6CB4EE", // 寒冷 - 浅蓝
  pulse: "#9B59D0", // 电磁 - 紫色
  fire: "#E74C3C", // 灼热 - 红色
  key: "#F39C12", // 关键词 - 橙色
  vup: "#2ECC71", // 数值提升 - 绿色
  poise: "#3498DB", // 失衡 - 蓝色
  info: "#95A5A6", // 信息 - 灰色

  // #ba. 状态/效果标记
  lastcombo: "#F1C40F", // 连携/重击 - 金色
  crystinflict: "#5DADE2", // 寒冷附着 - 天蓝
  pulseinflict: "#AF7AC5", // 电磁附着 - 淡紫
  spellvul: "#EC7063", // 法术脆弱 - 粉红
  spellburst: "#8E44AD", // 法术爆发 - 深紫
  consume: "#E74C3C", // 消耗 - 红色
  conduct: "#F4D03F", // 导电 - 黄色
  return: "#58D68D", // 返还 - 浅绿
  speedup: "#58D68D", // 加速 - 绿色
  slow: "#5DADE2", // 缓速 - 蓝色
  shield: "#85C1E9", // 护盾 - 浅蓝
  statuslevel: "#F39C12", // 异常等级 - 橙色

  // @tips. 提示标记
  purple: "#9B59D0", // 紫色提示
  orange: "#F39C12", // 橙色提示
};

/**
 * 格式化参数值
 * @param value 原始值（字符串）
 * @param format 格式说明（如 "0", "0%", "0.0" 等）
 * @returns 格式化后的字符串
 */
function formatParamValue(value: string, format: string): string {
  const numValue = parseFloat(value);

  if (isNaN(numValue)) {
    return value; // 如果不是数字，返回原值
  }

  // 根据格式后缀处理
  if (format.endsWith("%")) {
    // 百分比格式：0.15 -> 15%
    return `${(numValue * 100).toFixed(0)}%`;
  } else if (format.includes(".")) {
    // 小数格式：根据小数位数确定精度
    const decimals = format.split(".")[1].length;
    return numValue.toFixed(decimals);
  } else {
    // 整数格式
    return Math.round(numValue).toString();
  }
}

/**
 * 替换描述文本中的参数占位符
 * @param text 原始描述文本
 * @param params 参数字典
 * @returns 替换后的文本
 */
function replaceParams(text: string, params: Record<string, string>): string {
  // 支持多种格式：
  // 1. {param:format} - 简单参数
  // 2. {1-param:format} - 带数字前缀的参数
  // 3. {100*param:format} - 乘法表达式
  // 4. {param+1:format} - 加法表达式
  return text.replace(/\{([^}]+?):(.*?)\}/g, (match, fullParamName, format) => {
    let paramName = fullParamName;
    let multiplier = 1;
    let addend = 0;

    // 检查是否是乘法表达式，如 "100*ignore_fire_resist"
    const multiplyMatch = paramName.match(/^(\d+(?:\.\d+)?)\*(.+)$/);
    if (multiplyMatch) {
      multiplier = parseFloat(multiplyMatch[1]);
      paramName = multiplyMatch[2];
    }

    // 检查是否是加法表达式，如 "talent_1+1"
    const addMatch = paramName.match(/^(.+)\+(\d+(?:\.\d+)?)$/);
    if (addMatch) {
      paramName = addMatch[1];
      addend = parseFloat(addMatch[2]);
    }

    // 尝试直接查找参数
    let value = params[paramName];

    // 如果找不到，尝试去掉数字前缀（如 "1-", "2-" 等）
    if (value === undefined && paramName.includes("-")) {
      const parts = paramName.split("-");
      // 如果第一部分是数字，去掉它
      if (parts.length > 1 && /^\d+$/.test(parts[0])) {
        const actualParamName = parts.slice(1).join("-");
        value = params[actualParamName];
      }
    }

    if (value === undefined) {
      return match; // 如果参数不存在，保留原样
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

/**
 * 解析技能描述文本，将标记转换为带样式的 HTML
 * @param text 原始描述文本
 * @param params 参数字典（可选，用于替换占位符）
 * @returns 解析后的 HTML 字符串
 */
export function parseSkillDescription(
  text: string,
  params?: Record<string, string>,
): string {
  if (!text) return "";

  let result = text;

  // 第一步：替换参数占位符
  if (params) {
    result = replaceParams(result, params);
  }

  // 第二步：替换换行符
  result = result.replace(/\n/g, "<br/>");

  // 第三步：处理 <@ba.xxx> 标记（属性/图标）
  result = result.replace(/<@ba\.(\w+)>(.*?)<\/>/g, (tag, content) => {
    const color = TAG_COLORS[tag] || "#FFFFFF";
    return `<span class="ba-tag ba-at-${tag}" style="color: ${color}; font-weight: bold;">${content}</span>`;
  });

  // 第四步：处理 <#ba.xxx> 标记（状态/高亮）
  result = result.replace(/<#ba\.(\w+)>(.*?)<\/>/g, (tag, content) => {
    const color = TAG_COLORS[tag] || "#FFFFFF";
    return `<span class="ba-tag ba-hash-${tag}" style="color: ${color}; font-weight: bold;">${content}</span>`;
  });

  // 第五步：处理 <@tips.xxx> 标记（提示）
  result = result.replace(/<@tips\.(\w+)>(.*?)<\/>/g, (tag, content) => {
    const color = TAG_COLORS[tag] || "#FFFFFF";
    return `<span class="ba-tag ba-tips-${tag}" style="color: ${color}; font-weight: bold;">${content}</span>`;
  });

  return result;
}

/**
 * React 组件：渲染技能描述
 */
interface SkillDescriptionProps {
  description: string;
  params?: Record<string, string>; // 参数字典
  className?: string;
}

export function SkillDescription({
  description,
  params,
  className = "",
}: SkillDescriptionProps) {
  const html = parseSkillDescription(description, params);

  return (
    <div
      className={`skill-description ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
