import type { CardModule, CardMeta, CardLocales } from './types';
import i18n from '@/i18n';

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

// 自动扫描所有卡片的本地化文件 (cards/*/locales/*.json)
const cardLocaleFiles = import.meta.glob<Record<string, string>>(
  '../*/locales/*.json',
  { eager: true, import: 'default' }
);

function loadCardLocales(): CardLocales {
  const locales: CardLocales = {};

  for (const [path, content] of Object.entries(cardLocaleFiles)) {
    // 提取卡片目录名和语言
    // 路径格式: "../character-list/locales/zh.json"
    const match = path.match(/\.\.\/([^/]+)\/locales\/(\w+)\.json/);
    if (!match) continue;

    const [, cardDir, lang] = match;

    // 忽略以 _ 开头的目录
    if (cardDir.startsWith('_')) continue;

    // 将翻译内容注册到对应语言下
    if (!locales[lang]) {
      locales[lang] = {};
    }
    Object.assign(locales[lang], content);
  }

  return locales;
}

function registerCardLocales(locales: CardLocales) {
  for (const [lang, resources] of Object.entries(locales)) {
    if (!i18n.hasResourceBundle(lang, 'card')) {
      i18n.addResourceBundle(lang, 'card', resources, true, true);
    }
  }
}

export function loadAllCards(): Map<string, CardModule> {
  const cards = new Map<string, CardModule>();

  // 加载所有卡片的本地化资源
  const locales = loadCardLocales();
  registerCardLocales(locales);

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
