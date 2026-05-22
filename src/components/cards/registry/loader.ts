import type { CardModule, CardMeta } from './types';

// 自动扫描所有卡片的 meta.json 和 index.tsx
// 排除 base、registry 和 _template 目录
const cardModules = import.meta.glob<{ default: React.ComponentType<any> }>(
  '../*/index.tsx',
  { eager: true }
);

const cardMetas = import.meta.glob<CardMeta>(
  '../*/*.meta.json',
  { eager: true, import: 'default' }
);

export function loadAllCards(): Map<string, CardModule> {
  const cards = new Map<string, CardModule>();

  // 遍历所有 meta 文件
  for (const [path, meta] of Object.entries(cardMetas)) {
    // 提取卡片目录名，例如: "../character-list/character-list.meta.json" -> "character-list"
    const match = path.match(/\.\.\/([^/]+)\/[^/]+\.meta\.json/);
    if (!match) continue;
    
    const cardDir = match[1];
    
    // 忽略以 _ 开头的目录（如 _template）
    if (cardDir.startsWith('_')) {
      continue;
    }

    // 加载对应的组件
    const componentPath = `../${cardDir}/index.tsx`;
    const module = cardModules[componentPath];

    if (module) {
      cards.set(meta.id, {
        meta,
        component: module.default
      });
    }
  }

  return cards;
}

export function getAvailableCards(): CardMeta[] {
  return Array.from(loadAllCards().values()).map(m => m.meta);
}
