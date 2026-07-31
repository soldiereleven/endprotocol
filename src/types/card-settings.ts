// 卡片配置类型定义

export type SortOrder = "rarity" | "name" | "level";

export type CharacterListDisplayMode = "single" | "double" | "triple";

/**
 * CharacterList 卡片配置
 */
export interface CharacterListCardSettings {
  selectedCharIds?: string[];  // 选中的角色ID列表
  sortOrder?: SortOrder;       // 排列顺序
  displayMode?: CharacterListDisplayMode;  // 显示模式
  roleId?: string;             // 自定义角色ID（独立于dashboard的defaultRoleId）
}

/**
 * Attendance 签到卡片配置
 */
export interface AttendanceCardSettings {
  selectedRoleId?: string;  // 选中的角色ID（作为签到账户）
}

/**
 * 蚀刻章卡片配置
 */
export interface AchievementCardSettings {
  selectedMedalIds?: string[];
  featuredMedalId?: string;
  useDisplayList?: boolean;
  roleId?: string;
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
  attendance: AttendanceCardSettings;
  achievement: AchievementCardSettings;
  test_card: TestCardSettings;
  // 未来添加新卡片时在此注册
};

/**
 * 通用卡片配置接口
 */
export interface BaseCardSettings {
  [key: string]: any;
}
