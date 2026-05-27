// 卡片配置类型定义

export type SortOrder = "rarity" | "name" | "level";

/**
 * CharacterList 卡片配置
 */
export interface CharacterListCardSettings {
  selectedCharIds?: string[];  // 选中的角色ID列表
  sortOrder?: SortOrder;       // 排列顺序
}

/**
 * TestCard 卡片配置（示例）
 */
export interface TestCardSettings {
  customData?: any;  // 自定义数据
}

/**
 * 所有卡片配置的联合类型
 */
export type CardSettingsMap = {
  character_list: CharacterListCardSettings;
  test_card: TestCardSettings;
  // 未来添加新卡片时在此注册
};

/**
 * 通用卡片配置接口
 */
export interface BaseCardSettings {
  [key: string]: any;
}
