import json
import sys

def simplify_json(data, max_depth=10, current_depth=0):
    """递归简化 JSON，将数组缩减为只保留第一项"""
    if current_depth > max_depth:
        return data
    
    if isinstance(data, dict):
        return {key: simplify_json(value, max_depth, current_depth + 1) 
                for key, value in data.items()}
    elif isinstance(data, list):
        if len(data) == 0:
            return []
        # 只保留第一项，并递归简化
        return [simplify_json(data[0], max_depth, current_depth + 1)]
    else:
        return data

def main():
    input_file = 'f:/endprotocol/src-tauri/cache/char_detail.json'
    output_file = 'f:/endprotocol/src-tauri/cache/char_detail_simplified.json'
    
    print(f"Reading {input_file}...")
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print("Simplifying JSON (keeping only first item in each array)...")
    simplified = simplify_json(data)
    
    print(f"Writing simplified JSON to {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(simplified, f, ensure_ascii=False, indent=2)
    
    print("Done!")
    print(f"Original size: {len(json.dumps(data))} bytes")
    print(f"Simplified size: {len(json.dumps(simplified))} bytes")

if __name__ == '__main__':
    main()
