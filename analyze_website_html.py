import json
import re

# 读取 HTML 文件
with open('c:/Users/Misaka/Downloads/控制台 _ 终末地-协议终端.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

print(f"HTML file size: {len(html_content)} characters")
print(f"Number of lines: {html_content.count(chr(10)) + 1}")

# 搜索 JSON 数据
json_pattern = r'window\.__INITIAL_STATE__\s*=\s*({.*?});'
match = re.search(json_pattern, html_content, re.DOTALL)

if match:
    print("\nFound window.__INITIAL_STATE__")
    try:
        json_str = match.group(1)
        data = json.loads(json_str)
        print("JSON keys:", list(data.keys())
              if isinstance(data, dict) else "Not a dict")

        # 保存为 JSON 文件
        with open('website_data.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print("Saved to website_data.json")
    except Exception as e:
        print(f"Error parsing JSON: {e}")
else:
    print("No window.__INITIAL_STATE__ found")

    # 尝试其他模式
    patterns = [
        r'__INITIAL_STATE__\s*=\s*({.*?})',
        r'window\.data\s*=\s*({.*?})',
        r'const\s+data\s*=\s*({.*?})',
    ]

    for pattern in patterns:
        match = re.search(pattern, html_content, re.DOTALL)
        if match:
            print(f"\nFound pattern: {pattern[:50]}")
            break
