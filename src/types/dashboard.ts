// Dashboard 卡片类型定义

export enum CardType {
  CHARACTER_LIST = 'character_list',
  // 未来可扩展其他卡片类型
}

export interface CardConfig {
  id: string;              // 唯一卡片实例 ID（UUID）
  type: CardType;          // 卡片类型
  position: number;        // 显示顺序（从 0 开始）
  settings: CardSettings;  // 卡片特定设置
}

export interface CardSettings {
  title?: string;
  collapsed?: boolean;
  selectedCharIds?: string[];  // 用于 CHARACTER_LIST 类型
}

export interface DashboardConfig {
  cards: CardConfig[];
  lastUpdated: number;
}
