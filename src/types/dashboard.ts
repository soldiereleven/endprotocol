// Dashboard 卡片类型定义

export enum CardType {
  CHARACTER_LIST = 'character_list',
  // 未来可扩展其他卡片类型
}

export interface CardConfig {
  id: string;              // 唯一卡片实例 ID（UUID）
  type: CardType;          // 卡片类型
  position: number;        // 显示顺序（从 0 开始）
  x?: number;              // 网格 X 坐标（列）
  y?: number;              // 网格 Y 坐标（行）
  w?: number;              // 宽度（占据的列数）
  h?: number;              // 高度（占据的行数）
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
