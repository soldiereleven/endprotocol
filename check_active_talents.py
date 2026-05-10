import json

with open('src-tauri/cache/char_detail.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

detail = data['data']['detail']
first_char = detail['chars'][0]

talent_info = first_char['talent']
print('Talent info:')
print(json.dumps(talent_info, indent=2, ensure_ascii=False))

char_data = first_char['charData']
print('\n\nCombatTalents IDs:')
for talent in char_data.get('combatTalents', []):
    print(
        f'  {talent["id"]}: {talent["name"]} (Level: {talent["id"].split("_")[-1]})')

print('\n\nAbilityTalents IDs:')
for talent in char_data.get('abilityTalents', []):
    print(
        f'  {talent["id"]}: {talent["name"]} (Level: {talent["id"].split("_")[-1]})')

print('\n\nCultivationTalents IDs:')
for talent in char_data.get('cultivationTalents', []):
    print(
        f'  {talent["id"]}: {talent["name"]} (Level: {talent["id"].split("_")[-1]})')

# Check which talents are active
active_combat_ids = talent_info.get('latestPassiveSkillNodes', [])
print(f'\n\nActive combat talent IDs: {active_combat_ids}')

active_ability_ids = talent_info.get('attrNodes', [])
print(f'Active ability talent IDs: {active_ability_ids}')
