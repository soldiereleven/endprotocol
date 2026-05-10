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
  achieve?: any;
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
  talent?: TalentNodes; // 当前激活的天赋节点
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
