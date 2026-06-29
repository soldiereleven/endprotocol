import { CardConfig, CardTypeId, DashboardConfig, DashboardTab } from '@/types/dashboard';
import { v4 as uuidv4 } from 'uuid';
import { loadAllCards } from '@/components/cards/registry/loader';
import { CardConfigService } from './cardConfigService';
import { getAllTabs, saveTabs } from './tabService';

async function getTabById(tabId: string): Promise<DashboardTab | null> {
  const tabs = await getAllTabs();
  return tabs.find((t) => t.id === tabId) ?? null;
}

async function saveTabCards(tabId: string, cards: CardConfig[]): Promise<void> {
  const tabs = await getAllTabs();
  const index = tabs.findIndex((t) => t.id === tabId);
  if (index === -1) return;
  tabs[index].cards = cards;
  tabs[index].updatedAt = Date.now();
  await saveTabs(tabs);
}

export async function getDashboardConfig(tabId: string): Promise<DashboardConfig> {
  const tab = await getTabById(tabId);
  if (!tab) {
    return { cards: [], lastUpdated: Date.now() };
  }
  return {
    cards: tab.cards,
    lastUpdated: tab.updatedAt,
  };
}

function findBestPosition(
  cards: CardConfig[],
  cardW: number,
  cardH: number,
): { x: number; y: number } {
  let bestX = 0;
  let bestY = 0;
  let bestScore = Infinity;

  let maxX = 0;
  let maxY = 0;
  for (const card of cards) {
    const cardRight = (card.x ?? 0) + (card.w ?? 3);
    const cardBottom = (card.y ?? 0) + (card.h ?? 2);
    maxX = Math.max(maxX, cardRight);
    maxY = Math.max(maxY, cardBottom);
  }

  const searchRangeX = maxX + cardW + 2;
  const searchRangeY = maxY + cardH + 2;

  for (let y = 0; y < searchRangeY; y++) {
    for (let x = 0; x < searchRangeX; x++) {
      const hasCollision = cards.some((otherCard) => {
        const otherX = otherCard.x ?? 0;
        const otherY = otherCard.y ?? 0;
        const otherW = otherCard.w ?? 3;
        const otherH = otherCard.h ?? 2;
        return (
          x < otherX + otherW &&
          x + cardW > otherX &&
          y < otherY + otherH &&
          y + cardH > otherY
        );
      });

      if (!hasCollision) {
        const score = x + y;
        if (score < bestScore) {
          bestScore = score;
          bestX = x;
          bestY = y;
          if (bestScore === 0) {
            return { x: 0, y: 0 };
          }
        }
      }
    }
  }

  return { x: bestX, y: bestY };
}

export async function addCard(
  tabId: string,
  cardType: CardTypeId,
  options?: { w?: number; h?: number; settings?: Record<string, any> },
): Promise<string> {
  const config = await getDashboardConfig(tabId);

  const cardRegistry = loadAllCards();
  const cardMeta = cardRegistry.get(cardType)?.meta;
  const defaultW = options?.w ?? cardMeta?.defaultSize.w ?? 3;
  const defaultH = options?.h ?? cardMeta?.defaultSize.h ?? 2;

  const position = findBestPosition(config.cards, defaultW, defaultH);

  const cardId = uuidv4();

  const newCard: CardConfig = {
    id: cardId,
    type: cardType,
    position: config.cards.length,
    x: position.x,
    y: position.y,
    w: defaultW,
    h: defaultH,
    settings: {},
  };

  config.cards.push(newCard);
  await saveTabCards(tabId, config.cards);

  if (options?.settings) {
    await CardConfigService.saveCardSettings(cardId, options.settings);
  }

  return cardId;
}

export async function removeCard(tabId: string, cardId: string): Promise<void> {
  const config = await getDashboardConfig(tabId);
  config.cards = config.cards.filter((card) => card.id !== cardId);
  config.cards.forEach((card, index) => {
    card.position = index;
  });
  await saveTabCards(tabId, config.cards);
}

export async function moveCard(
  tabId: string,
  cardId: string,
  newPosition: number,
): Promise<void> {
  const config = await getDashboardConfig(tabId);
  const cardIndex = config.cards.findIndex((card) => card.id === cardId);
  if (cardIndex === -1) return;

  const [card] = config.cards.splice(cardIndex, 1);
  config.cards.splice(newPosition, 0, card);
  config.cards.forEach((c, index) => {
    c.position = index;
  });

  await saveTabCards(tabId, config.cards);
}

export async function updateCardLayout(
  tabId: string,
  cardId: string,
  layout: { x: number; y: number; w: number; h: number },
): Promise<void> {
  const config = await getDashboardConfig(tabId);
  const card = config.cards.find((c) => c.id === cardId);
  if (!card) return;

  card.x = layout.x;
  card.y = layout.y;
  card.w = layout.w;
  card.h = layout.h;

  await saveTabCards(tabId, config.cards);
}
