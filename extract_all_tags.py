import json
import re
from collections import Counter

# 读取 JSON 文件
with open('src-tauri/cache/char_detail_simplified.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# 收集所有标记
all_tags = set()


def extract_tags_from_text(text):
    """从文本中提取所有标记"""
    if not isinstance(text, str):
        return

    # 匹配 <@ba.xxx> 和 <#ba.xxx> 和 <@tips.xxx>
    patterns = [
        r'<@ba\.(\w+)>',
        r'<#ba\.(\w+)>',
        r'<@tips\.(\w+)>'
    ]

    for pattern in patterns:
        matches = re.findall(pattern, text)
        all_tags.update(matches)


def search_recursive(obj):
    """递归搜索对象中的所有字符串"""
    if isinstance(obj, dict):
        for key, value in obj.items():
            if key in ['desc', 'skillDesc', 'activeEffect', 'passiveEffect', 'function', 'description', 'pkg']:
                extract_tags_from_text(value)
            else:
                search_recursive(value)
    elif isinstance(obj, list):
        for item in obj:
            search_recursive(item)


# 开始搜索
search_recursive(data)

# 按前缀分组
ba_at_tags = sorted([tag for tag in all_tags if not tag.startswith('tips')])
tips_tags = sorted([tag for tag in all_tags if tag.startswith('tips')])

print("=" * 60)
print("所有发现的标记（按出现频率排序）")
print("=" * 60)

# 统计每个标记出现的次数
tag_counter = Counter()


def count_tags_in_text(text):
    if not isinstance(text, str):
        return

    patterns = [
        r'<@ba\.(\w+)>',
        r'<#ba\.(\w+)>',
        r'<@tips\.(\w+)>'
    ]

    for pattern in patterns:
        matches = re.findall(pattern, text)
        tag_counter.update(matches)


def count_recursive(obj):
    if isinstance(obj, dict):
        for key, value in obj.items():
            if key in ['desc', 'skillDesc', 'activeEffect', 'passiveEffect', 'function', 'description', 'pkg']:
                count_tags_in_text(value)
            else:
                count_recursive(value)
    elif isinstance(obj, list):
        for item in obj:
            count_recursive(item)


count_recursive(data)

print("\n@ba. 前缀标记（属性/图标）:")
for tag in sorted(tag_counter.keys()):
    if not tag.startswith('tips'):
        print(f"  {tag:30s} - 出现 {tag_counter[tag]:3d} 次")

print("\n@tips. 前缀标记（提示）:")
for tag in sorted(tag_counter.keys()):
    if tag.startswith('tips'):
        print(f"  {tag:30s} - 出现 {tag_counter[tag]:3d} 次")

# 生成 TypeScript 解析器代码
print("\n" + "=" * 60)
print("生成的 TypeScript 解析器代码")
print("=" * 60)

print("""
// 技能描述富文本解析器
export function parseSkillDescription(text: string): string {
  if (!text) return '';
  
  let result = text;
  
  // 替换换行符
  result = result.replace(/\\n/g, '<br/>');
  
""")

# 为每个标记生成 CSS 类名和颜色
color_map = {
    # @ba. 属性标记
    'cryst': '#6CB4EE',      # 寒冷 - 浅蓝
    'pulse': '#9B59D0',      # 电磁 - 紫色
    'fire': '#E74C3C',       # 灼热 - 红色
    'key': '#F39C12',        # 关键词 - 橙色
    'vup': '#2ECC71',        # 数值提升 - 绿色
    'poise': '#3498DB',      # 失衡 - 蓝色
    'info': '#95A5A6',       # 信息 - 灰色

    # #ba. 状态标记
    'lastcombo': '#F1C40F',  # 连携/重击 - 金色
    'crystinflict': '#5DADE2',  # 寒冷附着 - 天蓝
    'pulseinflict': '#AF7AC5',  # 电磁附着 - 淡紫
    'spellvul': '#EC7063',   # 法术脆弱 - 粉红
    'spellburst': '#8E44AD',  # 法术爆发 - 深紫
    'consume': '#E74C3C',    # 消耗 - 红色
    'conduct': '#F4D03F',    # 导电 - 黄色
    'return': '#58D68D',     # 返还 - 浅绿
    'speedup': '#58D68D',    # 加速 - 绿色
    'slow': '#5DADE2',       # 缓速 - 蓝色
    'shield': '#85C1E9',     # 护盾 - 浅蓝
    'statuslevel': '#F39C12',  # 异常等级 - 橙色
    'atb': '#3498DB',        # 技力 - 蓝色
    'atk_scale': '#E74C3C',  # 攻击力倍率 - 红色
    'heal_base': '#58D68D',  # 治疗量 - 绿色
    'will_additive': '#9B59D0',  # 意志加成 - 紫色
    'usp': '#F39C12',        # USP - 橙色
    'duration': '#95A5A6',   # 持续时间 - 灰色
    'maxcount': '#E67E22',   # 最大次数 - 橙红
    'triggerheal': '#58D68D',  # 触发治疗 - 绿色
    'value': '#95A5A6',      # 值 - 灰色
    'param1': '#3498DB',     # 参数1 - 蓝色
    'param2': '#9B59D0',     # 参数2 - 紫色
    'count': '#E67E22',      # 次数 - 橙红
    'range_talent1buff': '#3498DB',  # 天赋范围 - 蓝色
    'ratio_speed': '#58D68D',  # 速度比率 - 绿色
    'ratio_speedreduction': '#5DADE2',  # 减速比率 - 蓝色
    'duration_talent1buff': '#95A5A6',  # 天赋持续时间 - 灰色
    'dmg_up_water_ult': '#E74C3C',  # 水龙卷伤害提升 - 红色
    'atk_up': '#E74C3C',     # 攻击提升 - 红色
    'dmg_up': '#E74C3C',     # 伤害提升 - 红色
    'max_stack': '#F39C12',  # 最大层数 - 橙色

    # @tips. 提示标记
    'purple': '#9B59D0',     # 紫色提示
    'orange': '#F39C12',     # 橙色提示
}

print("  // 处理 <@ba.xxx> 标记（属性/图标）")
for tag in sorted(tag_counter.keys()):
    if not tag.startswith('tips') and tag in color_map:
        color = color_map[tag]
        print(
            f'  result = result.replace(/<@ba\\.{tag}>(.*?)<\\/>/g, \'<span class="ba-tag ba-at-{tag}" style="color: {color}; font-weight: bold;">$1</span>\');')

print("\n  // 处理 <#ba.xxx> 标记（状态/高亮）")
for tag in sorted(tag_counter.keys()):
    if not tag.startswith('tips') and tag in color_map:
        color = color_map[tag]
        print(
            f'  result = result.replace(/<#ba\\.{tag}>(.*?)<\\/>/g, \'<span class="ba-tag ba-hash-{tag}" style="color: {color}; font-weight: bold;">$1</span>\');')

print("\n  // 处理 <@tips.xxx> 标记（提示）")
for tag in sorted(tag_counter.keys()):
    if tag.startswith('tips') and tag in color_map:
        color = color_map[tag]
        print(
            f'  result = result.replace(/<@tips\\.{tag}>(.*?)<\\/>/g, \'<span class="ba-tag ba-tips-{tag}" style="color: {color}; font-weight: bold;">$1</span>\');')

print("""
  return result;
}
""")

# 生成 CSS
print("=" * 60)
print("生成的 CSS 样式")
print("=" * 60)
print("""
/* 技能描述标记样式 */
.ba-tag {
  display: inline-block;
  padding: 0 2px;
  border-radius: 2px;
  font-weight: bold;
}

/* @ba. 属性标记 */
""")

for tag in sorted(tag_counter.keys()):
    if not tag.startswith('tips') and tag in color_map:
        color = color_map[tag]
        print(f'.ba-at-{tag} {{ color: {color}; }}')

print("\n/* #ba. 状态标记 */")
for tag in sorted(tag_counter.keys()):
    if not tag.startswith('tips') and tag in color_map:
        color = color_map[tag]
        print(f'.ba-hash-{tag} {{ color: {color}; }}')

print("\n/* @tips. 提示标记 */")
for tag in sorted(tag_counter.keys()):
    if tag.startswith('tips') and tag in color_map:
        color = color_map[tag]
        print(f'.ba-tips-{tag} {{ color: {color}; }}')

print("\n" + "=" * 60)
print(f"总共发现 {len(all_tags)} 个唯一标记")
print("=" * 60)
