// 角色详情数据类型定义

export interface CharDetailResponse {
  code: number;
  message: string;
  timestamp: string;
  data: CharDetailDataWrapper;
}

export interface CharDetailDataWrapper {
  detail: CharDetailData;
}

export interface CharDetailData {
  base: BaseInfo;
  chars: CharacterItem[];
  dungeon?: any;
  bpSystem?: BpSystem;
  dailyMission?: DailyMission;
  weeklyMission?: WeeklyMission;
  spaceShip?: any;
  domain?: any;
  quickaccess?: any;
  config?: any;
  achieve?: AchieveData;
  currentTs?: number;
}

export interface BaseInfo {
  serverName: string;
  roleId: string;
  name: string;
  createTime: string;
  saveTime: string;
  lastLoginTime: string;
  exp: number;
  level: number;
  worldLevel: number;
  gender: number;
  avatarUrl: string;
  mainMission: MainMission;
  charNum: number;
  weaponNum: number;
  docNum: number;
}

export interface MainMission {
  id: string;
  description: string;
}

export interface CharacterItem {
  charData: CharacterData;
  id: string;
  level?: number;
  evolvePhase?: number;
  potentialLevel?: number;
  userSkills?: any;
  bodyEquip?: any;
  armEquip?: any;
  firstAccessory?: any;
  secondAccessory?: any;
  weapon?: any;
  tacticalItem?: any;
  talent?: TalentNodes;
  wikiItemId?: string;
}

export interface CharacterData {
  id: string;
  name: string;
  avatarSqUrl: string;
  avatarRtUrl: string;
  rarity: RarityInfo;
  profession: ProfessionInfo;
  property: PropertyInfo;
  weaponType: WeaponTypeInfo;
  skills: SkillInfo[];
  illustrationUrl: string;
  tags: string[];
  abilityTalents: TalentInfo[];
  combatTalents: TalentInfo[];
  cultivationTalents?: TalentInfo[];
}

export interface RarityInfo {
  key: string;
  value: string; // "6", "5", etc.
}

export interface ProfessionInfo {
  key: string;
  value: string; // "术师", "近卫", etc.
}

export interface PropertyInfo {
  key: string;
  value: string; // "寒冷", "物理", etc.
}

export interface WeaponTypeInfo {
  key: string;
  value: string; // "手铳", "剑", etc.
}

export interface SkillInfo {
  id: string;
  name: string;
  type: SkillTypeInfo;
  property: PropertyInfo;
  iconUrl: string;
  desc: string;
  descParams: Record<string, any>;
  descLevelParams: Record<string, any>;
}

export interface SkillTypeInfo {
  key: string;
  value: string; // "普通攻击", "战技", etc.
}

export interface TalentInfo {
  id: string;
  name: string;
  iconUrl: string;
  desc: string;
  descParams?: Record<string, any>;
  lockedIconUrl: string;
}

export interface TalentNodes {
  latestBreakNode: string;
  attrNodes: string[]; // 能力天赋节点 ID
  latestPassiveSkillNodes: string[]; // 战斗天赋节点 ID
  latestFactorySkillNodes: string[]; // 制造天赋节点 ID
  latestSpaceshipSkillNodes: string[]; // 培养天赋节点 ID
}

// ====== Wiki 相关类型 ======

/** Wiki 分类目录 */
export interface WikiCatalog {
  code: number;
  message: string;
  timestamp: string;
  data: WikiCatalogData;
}

export interface WikiCatalogData {
  catalog: WikiCatalogEntry[];
}

export interface WikiCatalogEntry {
  typeMain: number;
  typeSub: WikiTypeSub[];
}

export interface WikiTypeSub {
  typeSubId: number;
  typeSubName: string;
  items: WikiCatalogItem[];
}

/** Wiki 目录中的单个物品条目 */
export interface WikiCatalogItem {
  itemId: string;
  name: string;
  iconUrl?: string;
  rarity?: number;
  type?: string;
  [key: string]: any;
}

/** Wiki 物品详情响应 */
export interface WikiItemResponse {
  code: number;
  message: string;
  timestamp: string;
  data: WikiItemData;
}

export interface WikiItemData {
  item: WikiItemDetail;
}

/** 文档内联元素 */
export interface WikiInlineElement {
  kind: "text" | "link" | "image";
  text?: { text: string; href?: string };
  image?: { src: string; alt?: string };
}

/** 文档块 */
export interface WikiDocumentBlock {
  id: string;
  parentId: string;
  align?: string;
  kind: "text" | "heading3" | "horizontalLine" | "image" | "quote" | "table";
  text?: {
    inlineElements: WikiInlineElement[];
    kind: "body";
  };
  image?: { src: string; alt?: string };
  type?: "common";
  tableList?: any[];
  tabList?: WikiDocTab[];
  tabDataMap?: Record<string, WikiTabData>;
}

/** 文档标签页定义 */
export interface WikiDocTab {
  tabId: string;
  title: string;
  icon: string;
}

/** 文档标签页数据 */
export interface WikiTabData {
  intro: WikiTabIntro | null;
  content: string;
  audioList: any[];
}

/** 标签页介绍头 */
export interface WikiTabIntro {
  name: string;
  type: string;
  imgUrl?: string;
  description?: string;
}

/** 文档条目（block 型） */
export interface WikiBlockDocumentEntry {
  id: string;
  blockIds: string[];
  blockMap: Record<string, WikiDocumentBlock>;
}

/** 文档条目（tab 型） */
export interface WikiTabDocumentEntry {
  type: "common";
  tableList: any[];
  tabList: WikiDocTab[];
  tabDataMap: Record<string, WikiTabData>;
}

/** 文档条目 */
export type WikiDocumentEntry = WikiBlockDocumentEntry | WikiTabDocumentEntry;

/** 关联对象 */
export interface WikiAssociate {
  id: string;
  name: string;
  type: string;
  dotType: string;
}

/** 子类型映射 */
export interface WikiSubTypeEntry {
  subTypeId: string;
  value: string;
}

/** 主/子分类 */
export interface WikiTypeInfo {
  id: string;
  name: string;
  status?: number;
  position?: number;
  typeSub?: any[];
  fatherTypeId?: string;
  style?: number;
  icon?: string;
  items?: any[];
  filterTagTree?: any[];
}

/** Wiki 物品详情 */
export interface WikiItemDetail {
  itemId: string;
  name: string;
  brief?: string;
  lang?: string;
  document: {
    documentMap: Record<string, WikiDocumentEntry>;
    associate: WikiAssociate;
    dotType: string;
    subTypeList: WikiSubTypeEntry[];
    composite: any;
    disableCoverShowInDetail: boolean;
  };
  mainType: WikiTypeInfo;
  subType: WikiTypeInfo;
  status: number;
  publishedAtTs: string;
  lastAuditPassedAt: string;
  tagIds: string[];
  createdUser?: any;
  lastUpdatedUser?: any;
}

export interface BpSystem {
  curLevel: number;
  maxLevel: number;
}

export interface DailyMission {
  dailyActivation: number;
  maxDailyActivation: number;
}

export interface WeeklyMission {
  score: number;
  total: number;
}

// ====== 成就/奖章相关类型 ======

export interface AchievementData {
  id: string;
  name: string;
  initIcon: string;
  reforge2Icon: string;
  reforge3Icon: string;
  platedIcon: string;
  cateName: string;
  canCertify: boolean;
  cate: string;
  initLevel: number;
}

export interface AchieveMedal {
  achievementData: AchievementData;
  level: number;
  isPlated: boolean;
  obtainTs: string;
}

export interface AchieveData {
  achieveMedals: AchieveMedal[];
  display?: Record<string, string>;
}
