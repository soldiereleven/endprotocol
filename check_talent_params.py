import json

with open('src-tauri/cache/char_detail_simplified.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

detail = data['data']['detail']
print('Keys in detail:')
for k in detail.keys():
    print(f'  {k}')

print(f'\nNumber of chars: {len(detail.get("chars", []))}')

if detail.get('chars'):
    first_char = detail['chars'][0]
    print('\nFirst char keys:')
    for k in first_char.keys():
        print(f'  {k}')

    if 'charData' in first_char:
        char_data = first_char['charData']
        print('\nKeys in charData:')
        for k in char_data.keys():
            print(f'  {k}')

        # Check talents
        talent_keys = [k for k in char_data.keys() if 'talent' in k.lower()]
        if talent_keys:
            print('\nTalent-related keys:')
            for key in talent_keys:
                print(f'  {key}: {type(char_data[key]).__name__}')
                if isinstance(char_data[key], list) and len(char_data[key]) > 0:
                    first_talent = char_data[key][0]
                    print(
                        f'    First talent keys: {list(first_talent.keys())}')
                    if 'descParams' in first_talent:
                        print(f'    descParams: {first_talent["descParams"]}')
                    if 'descLevelParams' in first_talent:
                        print(
                            f'    descLevelParams keys: {list(first_talent["descLevelParams"].keys())}')
