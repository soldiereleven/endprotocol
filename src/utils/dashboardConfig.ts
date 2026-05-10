import { getConfig, setConfig } from './configService';
import { CardConfig, CardType, DashboardConfig } from '@/types/dashboard';
import { v4 as uuidv4 } from 'uuid';

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
          type: CardType.CHARACTER_LIST,
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
 * 添加卡片
 */
export async function addCard(roleId: string, cardType: CardType): Promise<void> {
  const config = await getDashboardConfig(roleId);
  
  const newCard: CardConfig = {
    id: uuidv4(),
    type: cardType,
    position: config.cards.length,
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
