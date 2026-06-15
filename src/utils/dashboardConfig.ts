import { getConfig, setConfig } from './configService';
import { CardConfig, CardTypeId, DashboardConfig } from '@/types/dashboard';
import { v4 as uuidv4 } from 'uuid';
import { loadAllCards } from '@/components/cards/registry/loader';

/**
 * 获取 Dashboard 配置
 */
export async function getDashboardConfig(roleId: string): Promise<DashboardConfig> {
  const key = `dashboard_config_${roleId}`;
  const config = await getConfig<DashboardConfig>(key);
  
  if (!config) {
    // 返回默认配置（包含一个干员列表卡片）
    return {
      cards: [
        {
          id: uuidv4(),
          type: 'character_list',
          position: 0,
          settings: {}
        }
      ],
      lastUpdated: Date.now()
    };
  }
  
  return config;
}

/**
 * 保存 Dashboard 配置
 */
export async function saveDashboardConfig(
  roleId: string,
  config: DashboardConfig
): Promise<void> {
  const key = `dashboard_config_${roleId}`;
  await setConfig(key, {
    ...config,
    lastUpdated: Date.now()
  });
}

/**
 * 寻找最佳的卡片位置（最小 x+y 且不重叠）
 */
function findBestPosition(
  cards: CardConfig[],
  cardW: number,
  cardH: number
): { x: number; y: number } {
  //const GRID_SIZE = 100;
  
  // 从 (0, 0) 开始尝试所有可能的位置
  let bestX = 0;
  let bestY = 0;
  let bestScore = Infinity;
  
  // 找到当前最大范围
  let maxX = 0;
  let maxY = 0;
  for (const card of cards) {
    const cardRight = (card.x ?? 0) + (card.w ?? 3);
    const cardBottom = (card.y ?? 0) + (card.h ?? 2);
    maxX = Math.max(maxX, cardRight);
    maxY = Math.max(maxY, cardBottom);
  }
  
  // 扩大搜索范围，留出一些空间
  const searchRangeX = maxX + cardW + 2;
  const searchRangeY = maxY + cardH + 2;
  
  // 遍历所有可能的位置
  for (let y = 0; y < searchRangeY; y++) {
    for (let x = 0; x < searchRangeX; x++) {
      // 检查是否与现有卡片重叠
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
      
      // 如果没有碰撞，计算分数（x + y 越小越好）
      if (!hasCollision) {
        const score = x + y;
        if (score < bestScore) {
          bestScore = score;
          bestX = x;
          bestY = y;
          
          // 如果找到 (0, 0) 位置，直接返回（最优解）
          if (bestScore === 0) {
            return { x: 0, y: 0 };
          }
        }
      }
    }
  }
  
  return { x: bestX, y: bestY };
}

/**
 * 添加卡片
 */
export async function addCard(roleId: string, cardType: CardTypeId): Promise<void> {
  const config = await getDashboardConfig(roleId);
  
  // 获取卡片元数据以确定默认尺寸
  const cardRegistry = loadAllCards();
  const cardMeta = cardRegistry.get(cardType)?.meta;
  const defaultW = cardMeta?.defaultSize.w ?? 3;
  const defaultH = cardMeta?.defaultSize.h ?? 2;
  
  // 寻找最佳位置
  const position = findBestPosition(config.cards, defaultW, defaultH);
  
  const newCard: CardConfig = {
    id: uuidv4(),
    type: cardType,
    position: config.cards.length,
    x: position.x,
    y: position.y,
    w: defaultW,
    h: defaultH,
    settings: {}
  };
  
  config.cards.push(newCard);
  await saveDashboardConfig(roleId, config);
}

/**
 * 删除卡片
 */
export async function removeCard(roleId: string, cardId: string): Promise<void> {
  const config = await getDashboardConfig(roleId);
  config.cards = config.cards.filter(card => card.id !== cardId);
  
  // 重新索引位置
  config.cards.forEach((card, index) => {
    card.position = index;
  });
  
  await saveDashboardConfig(roleId, config);
}

/**
 * 移动卡片
 */
export async function moveCard(
  roleId: string,
  cardId: string,
  newPosition: number
): Promise<void> {
  const config = await getDashboardConfig(roleId);
  const cardIndex = config.cards.findIndex(card => card.id === cardId);
  
  if (cardIndex === -1) return;
  
  // 从旧位置移除
  const [card] = config.cards.splice(cardIndex, 1);
  
  // 插入到新位置
  config.cards.splice(newPosition, 0, card);
  
  // 重新索引位置
  config.cards.forEach((c, index) => {
    c.position = index;
  });
  
  await saveDashboardConfig(roleId, config);
}

/**
 * 更新卡片网格位置
 */
export async function updateCardLayout(
  roleId: string,
  cardId: string,
  layout: { x: number; y: number; w: number; h: number }
): Promise<void> {
  const config = await getDashboardConfig(roleId);
  const card = config.cards.find(c => c.id === cardId);
  
  if (!card) return;
  
  card.x = layout.x;
  card.y = layout.y;
  card.w = layout.w;
  card.h = layout.h;
  
  await saveDashboardConfig(roleId, config);
}
