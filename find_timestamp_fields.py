import re
import json

# 读取 JSON 文件
with open('src-tauri/cache/char_detail.json', 'r', encoding='utf-8') as f:
    content = f.read()

# 查找所有时间戳样式的字符串
matches = re.findall(r'"(\w+)":\s*"(17\d{9})"', content)
print(f'Found {len(matches)} timestamp-like strings:')
for field_name, value in matches[:20]:
    print(f'  {field_name}: {value}')

# 检查 position 376975 附近的完整结构
print(f'\nPosition 376975 context:')
print(repr(content[376900:377100]))
