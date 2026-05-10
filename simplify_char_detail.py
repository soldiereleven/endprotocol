import json

# 读取原始 JSON 文件
with open('f:/endprotocol/src-tauri/cache/char_detail.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# 只保留第一个角色
if 'data' in data and 'detail' in data['data'] and 'chars' in data['data']['detail']:
    chars = data['data']['detail']['chars']
    if len(chars) > 0:
        # 只保留第一个角色
        data['data']['detail']['chars'] = [chars[0]]
        print(f"原始角色数量: {len(chars)}")
        print(f"简化后角色数量: 1")
    else:
        print("没有角色数据")
else:
    print("数据结构不符合预期")

# 保存简化后的 JSON
with open('f:/endprotocol/src-tauri/cache/char_detail_simplified.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("简化完成！已保存到 char_detail_simplified.json")
