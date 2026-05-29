// 卡片标签接口（支持多语言）
export interface CardTag {
  id: string;
  label: Record<string, string>;
}

// 卡片元数据接口
export interface CardMeta {
  id: string;              // 卡片类型唯一标识
  name: Record<string, string>;  // 多语言名称 {zh: "...", en: "..."}
  description: Record<string, string>;  // 多语言描述
  icon: string;            // emoji 或图标类名
  defaultSize: { w: number; h: number };  // 默认网格尺寸
  version: string;         // 卡片版本
  allowMultiple?: boolean; // 是否允许多个实例（默认 false）
  tags?: CardTag[];         // 卡片标签（多语言），用于搜索和筛选
}

// 卡片组件 Props 标准接口
export interface BaseCardProps {
  roleId: string;          // 角色ID
  cardId: string;          // 卡片实例ID
  settings: any;           // 卡片配置
  isEditMode?: boolean;    // 编辑模式标志
}

// 卡片翻译资源（每个语言一个对象）
export interface CardLocales {
  [language: string]: Record<string, string>;
}

// 卡片模块导出接口
export interface CardModule {
  meta: CardMeta;
  component: React.ComponentType<BaseCardProps>;
  locales?: CardLocales;   // 卡片本地化翻译资源
}
