import json
import re
from collections import Counter

with open('src-tauri/cache/char_detail.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# 收集所有占位符
all_placeholders = set()


def extract_placeholders(obj):
    """递归提取所有字符串中的占位符"""
    if isinstance(obj, dict):
        for key, value in obj.items():
            if key in ['desc', 'skillDesc', 'activeEffect', 'passiveEffect', 'function']:
                if isinstance(value, str):
                    # 匹配 {xxx:format} 格式
                    matches = re.findall(r'\{([^}]+?)\}', value)
                    all_placeholders.update(matches)
            else:
                extract_placeholders(value)
    elif isinstance(obj, list):
        for item in obj:
            extract_placeholders(item)


extract_placeholders(data)

print(f"Found {len(all_placeholders)} unique placeholder patterns:\n")

# 分类显示
simple_params = []  # 简单参数名，如 "poise"
prefixed_params = []  # 带前缀的参数，如 "1-shelterrate"
expression_params = []  # 表达式，如 "100*ignore_fire_resist"

for placeholder in sorted(all_placeholders):
    if '*' in placeholder or '/' in placeholder or '+' in placeholder or '-' in placeholder.split(':')[0]:
        expression_params.append(placeholder)
    elif '-' in placeholder.split(':')[0] and placeholder.split(':')[0].split('-')[0].isdigit():
        prefixed_params.append(placeholder)
    else:
        simple_params.append(placeholder)

print("=" * 60)
print("SIMPLE PARAMETERS (简单参数):")
print("=" * 60)
for p in sorted(simple_params):
    print(f"  {{{p}}}")

print("\n" + "=" * 60)
print("PREFIXED PARAMETERS (带数字前缀的参数):")
print("=" * 60)
for p in sorted(prefixed_params):
    param_name = p.split(':')[0]
    actual_name = '-'.join(param_name.split('-')[1:])  # 去掉数字前缀
    print(f"  {{{p}}} -> actual param: '{actual_name}'")

print("\n" + "=" * 60)
print("EXPRESSION PARAMETERS (表达式参数):")
print("=" * 60)
for p in sorted(expression_params):
    print(f"  {{{p}}}")

print("\n" + "=" * 60)
print("SUMMARY:")
print("=" * 60)
print(f"Simple parameters: {len(simple_params)}")
print(f"Prefixed parameters: {len(prefixed_params)}")
print(f"Expression parameters: {len(expression_params)}")
print(f"Total: {len(all_placeholders)}")
