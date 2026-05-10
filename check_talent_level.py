import json

with open('src-tauri/cache/char_detail.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

detail = data['data']['detail']
first_char = detail['chars'][0]

print('First char keys:')
for k in first_char.keys():
    print(f'  {k}: {type(first_char[k]).__name__}')

if 'talent' in first_char:
    print(f'\ntalent field: {first_char["talent"]}')

char_data = first_char['charData']
print('\nChecking combatTalents levels:')
for i, talent in enumerate(char_data.get('combatTalents', [])):
    print(f'  Talent {i+1}: {talent["name"]} - id: {talent["id"]}')
