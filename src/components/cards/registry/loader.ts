import type { CardModule, CardMeta, CardLocales } from './types';
import { CardStartupService } from '@/cards/startup-service';
import i18n from '@/i18n';

// 自动扫描所有卡片的 meta.json 和 index.tsx
// 排除 base、registry 和 _template 目录
const cardModules = import.meta.glob<{
  default: React.ComponentType<any>;
  startup?: (roleId: string) => Promise<void>;
}>(
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

let cachedRegistry: Map<string, CardModule> | null = null;

function buildCardLocales(): CardLocales {
  const locales: CardLocales = {};

  for (const [path, content] of Object.entries(cardLocaleFiles)) {
    const match = path.match(/\.\.\/([^/]+)\/locales\/(\w+)\.json/);
    if (!match) continue;

    const [, cardDir, lang] = match;

    if (cardDir.startsWith('_')) continue;

    if (!locales[lang]) {
      locales[lang] = {};
    }
    Object.assign(locales[lang], content);
  }

  return locales;
}

function buildCardRegistry(): Map<string, CardModule> {
  const cards = new Map<string, CardModule>();

  // 一次性注册所有卡片本地化资源
  const locales = buildCardLocales();
  for (const [lang, resources] of Object.entries(locales)) {
    i18n.addResourceBundle(lang, 'card', resources, true, true);
  }

  for (const [path, meta] of Object.entries(cardMetas)) {
    const match = path.match(/\.\.\/([^/]+)\/[^/]+\.meta\.json/);
    if (!match) continue;
    
    const cardDir = match[1];
    
    if (cardDir.startsWith('_')) {
      continue;
    }

    const componentPath = `../${cardDir}/index.tsx`;
    const module = cardModules[componentPath];

    if (module) {
      const cardModule: CardModule = {
        meta,
        component: module.default,
      };

      if (module.startup) {
        cardModule.startup = module.startup;
        CardStartupService.register(meta.id, module.startup);
      }

      cards.set(meta.id, cardModule);
    }
  }

  return cards;
}

export function loadAllCards(): Map<string, CardModule> {
  if (!cachedRegistry) {
    cachedRegistry = buildCardRegistry();
  }
  return cachedRegistry;
}

export function getAvailableCards(): CardMeta[] {
  return Array.from(loadAllCards().values()).map(m => m.meta);
}
