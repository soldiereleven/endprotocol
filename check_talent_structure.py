import json

with open('src-tauri/cache/char_detail_simplified.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

detail = data['data']['detail']
first_char = detail['chars'][0]
char_data = first_char['charData']

# Check all talent types
for talent_type in ['abilityTalents', 'combatTalents', 'cultivationTalents']:
    talents = char_data.get(talent_type, [])
    print(f'\n{talent_type}:')
    for i, talent in enumerate(talents):
        print(f'  Talent {i+1}: {talent["name"]}')
        print(f'    desc: {talent["desc"][:100]}...' if len(
            talent["desc"]) > 100 else f'    desc: {talent["desc"]}')
        print(f'    descParams: {talent.get("descParams", {})}')

        # Check for level-related fields
        level_fields = [k for k in talent.keys() if 'level' in k.lower()]
        if level_fields:
            print(f'    Level fields: {level_fields}')

        # Check for params at different levels
        params_fields = [k for k in talent.keys() if 'param' in k.lower()]
        if params_fields:
            print(f'    Params fields: {params_fields}')

        # Print all keys
        print(f'    All keys: {list(talent.keys())}')
