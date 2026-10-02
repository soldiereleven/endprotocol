import { invoke } from '@tauri-apps/api/core';
import logger, {  logError } from "./logger";

/**
 * 账户信息接口
 */
export interface Account {
  id: string;
  avatar: string;
  nickname: string;
  level: number;
  server: string;
  status: 'online' | 'offline' | 'loading';
  syncStatus?: 'SYNCING' | 'FAILED' | 'HYTOKEN_EXPIRED' | null; // 同步状态
  cred?: string;
  token?: string;
  userId?: string;
  serverId?: string;
}

export interface SklandAccount {
  userId: string;
  gameRoleCount: number;
  /** 已缓存的森空岛昵称（未获取过时为空） */
  nickname?: string;
  /** 已缓存的森空岛头像地址（未获取过时为空） */
  avatar?: string;
}

/**
 * 森空岛用户在单个游戏下的等级/积分
 */
export interface SklandGameScore {
  gameId: number;
  level: number;
  iconUrl: string;
  darkModeIconUrl: string;
  checkedDays: number;
  score: number;
  gameName: string;
  levelUrl: string;
}

/**
 * 森空岛头像挂件
 */
export interface SklandPendant {
  id: number;
  iconUrl: string;
  title: string;
  description: string;
}

/**
 * 森空岛个人主页背景
 */
export interface SklandBackground {
  id: number;
  url: string;
  resourceKind: number;
}

/**
 * 森空岛社区互动数据（接口以字符串返回数值）
 */
export interface SklandUserStats {
  liked: string;
  collect: string;
  comment: string;
  follow: string;
  fans: string;
  black: string;
  pub: string;
}

/**
 * 森空岛游戏基础信息（GET /web/v1/game）
 */
export interface SklandGameInfo {
  gameId: number;
  name: string;
  iconUrl: string;
  backgroundUrl: string;
}

/**
 * 森空岛用户资料（GET /web/v1/user）
 */
export interface SklandUserInfo {
  id: string;
  nickname: string;
  profile: string;
  avatar: string;
  avatarCode: number;
  backgroundCode: number;
  isCreator: boolean;
  status: number;
  operationStatus: number;
  identity: number;
  kind: number;
  latestIpLocation: string;
  moderatorStatus: number;
  moderatorChangeTime: number;
  gender: number;
  birthday: string;
  hgId: string;
  showId: string;
  scoreInfoList: SklandGameScore[];
  pendant?: SklandPendant;
  stats?: SklandUserStats;
  background?: SklandBackground;
}

/**
 * 角色展示信息接口
 */
export interface RoleDisplayInfo {
  roleId: string;
  userId: string;
  serverId: string;
  nickname: string;
  level: number;
  avatarUrl: string;
}

/**
 * 登录请求接口
 */
export interface LoginRequest {
  phone: string;
  password: string;
}

/**
 * 登录结果接口
 */
export interface LoginResult {
  success: boolean;
  errorMessage?: string;
  account?: Account;
  availableRoles?: RoleDisplayInfo[];
  cred?: string;
  token?: string;
  userId?: string;
}

/**
 * 刷新结果接口
 */
export interface RefreshResult {
  success: boolean;
  errorMessage?: string;
  accounts: Account[];
  refreshTime: string;
}

/**
 * 发送验证码请求接口
 */
export interface SendCodeRequest {
  phone: string;
  type: number;
}

/**
 * 验证码登录请求接口
 */
export interface CodeLoginRequest {
  phone: string;
  code: string;
}

/**
 * 扫码登录信息接口
 */
export interface ScanLoginInfo {
  scanId: string;
  scanUrl: string;
}

/**
 * 扫码登录状态接口
 */
export interface ScanStatus {
  status: number;
  scanCode?: string;
  msg?: string;
}

/**
 * 获取所有账户
 * @returns 账户列表
 */
export async function getAccounts(): Promise<Account[]> {
  try {
    return await invoke('get_accounts');
  } catch (error) {
    logError('Failed to get accounts:', error);
    return [];
  }
}

export async function getSklandAccounts(): Promise<SklandAccount[]> {
  try {
    return await invoke('get_skland_accounts');
  } catch (error) {
    logError('Failed to get Skland accounts:', error);
    return [];
  }
}

export async function saveSklandAccount(
  cred: string,
  token: string,
  userId: string,
): Promise<boolean> {
  try {
    return await invoke('save_skland_account', { cred, token, userId });
  } catch (error) {
    logError('Failed to save Skland account:', error);
    return false;
  }
}

export async function getSklandAccountRoles(userId: string): Promise<LoginResult> {
  try {
    return await invoke('get_skland_account_roles', { userId });
  } catch (error) {
    logError('Failed to get Skland account roles:', error);
    return { success: false, errorMessage: String(error) };
  }
}

/**
 * 获取森空岛账户的用户资料（昵称、头像、游戏等级/积分、社区互动数据）
 * @param userId 森空岛用户 ID
 * @returns 用户资料
 */
export async function getSklandUserInfo(userId: string): Promise<SklandUserInfo> {
  return await invoke('get_skland_user_info', { userId });
}

/**
 * 获取森空岛游戏列表（游戏图标等基础信息，后端带缓存）
 * @param userId 用于鉴权的森空岛用户 ID
 * @param force 是否强制刷新缓存
 * @returns 游戏列表
 */
export async function getSklandGames(
  userId: string,
  force: boolean = false,
): Promise<SklandGameInfo[]> {
  return await invoke('get_skland_games', { userId, force });
}

/**
 * 添加账户（登录）
 * @param loginRequest 登录请求（手机号和密码）
 * @returns 登录结果
 */
export async function addAccount(loginRequest: LoginRequest): Promise<LoginResult> {
  try {
    return await invoke('add_account', { loginRequest });
  } catch (error) {
    logError('Failed to add account:', error);
    return {
      success: false,
      errorMessage: String(error),
      account: undefined,
    };
  }
}

/**
 * 登出单个账户
 * @param accountId 账户ID
 * @param keepDeviceToken 是否保留设备认证（保留则下次密码登录跳过新设备验证）
 * @returns 是否成功
 */
export async function logoutAccount(
  accountId: string,
  keepDeviceToken: boolean = true,
): Promise<boolean> {
  try {
    return await invoke('logout_account', { accountId, keepDeviceToken });
  } catch (error) {
    logError('Failed to logout account:', error);
    return false;
  }
}

/**
 * 批量登出账户
 * @param accountIds 账户ID列表
 * @returns 是否成功
 */
export async function batchLogout(accountIds: string[]): Promise<boolean> {
  try {
    return await invoke('batch_logout', { accountIds });
  } catch (error) {
    logError('Failed to batch logout:', error);
    return false;
  }
}

/**
 * 刷新账户数据
 * @returns 刷新结果
 */
export async function refreshAccounts(): Promise<RefreshResult> {
  try {
    return await invoke('refresh_accounts');
  } catch (error) {
    logError('Failed to refresh accounts:', error);
    return {
      success: false,
      errorMessage: String(error),
      accounts: [],
      refreshTime: new Date().toISOString(),
    };
  }
}

// 别名导出，兼容前端代码的旧命名
export const refreshAccountData = refreshAccounts;
export const batchLogoutAccounts = batchLogout;

/**
 * 发送验证码
 * @param request 发送验证码请求
 * @returns 是否成功
 */
export async function sendVerificationCode(request: SendCodeRequest): Promise<boolean> {
  try {
    return await invoke('send_verification_code', { request });
  } catch (error) {
    logError('Failed to send verification code:', error);
    return false;
  }
}

/**
 * 通过验证码添加账户
 * @param loginRequest 验证码登录请求
 * @returns 登录结果
 */
export async function addAccountByCode(loginRequest: CodeLoginRequest): Promise<LoginResult> {
  try {
    return await invoke('add_account_by_code', { loginRequest });
  } catch (error) {
    logger.error('Failed to add account by code: ' + error, "AccountService");
    return {
      success: false,
      errorMessage: String(error),
      account: undefined,
    };
  }
}

/**
 * 生成扫码登录二维码
 * @returns 扫码登录信息（scanId 和 scanUrl）
 */
export async function genScanLogin(): Promise<ScanLoginInfo | null> {
  try {
    return await invoke('gen_scan_login');
  } catch (error) {
    logError('Failed to generate scan login:', error);
    return null;
  }
}

/**
 * 查询扫码登录状态
 * @param scanId 扫码登录 ID
 * @returns 扫码登录状态
 */
export async function scanStatus(scanId: string): Promise<ScanStatus | null> {
  try {
    return await invoke('scan_status', { scanId });
  } catch (error) {
    logError('Failed to get scan status:', error);
    return null;
  }
}

/**
 * 通过扫码添加账户
 * @param scanCode 扫码登录成功后返回的扫描码
 * @returns 登录结果
 */
export async function addAccountByScan(scanCode: string): Promise<LoginResult> {
  try {
    return await invoke('add_account_by_scan', { scanCode });
  } catch (error) {
    logger.error('Failed to add account by scan: ' + error, "AccountService");
    return {
      success: false,
      errorMessage: String(error),
      account: undefined,
    };
  }
}

/**
 * 保存用户选择的角色
 * @param cred 凭证
 * @param token 令牌
 * @param userId 用户ID
 * @param selectedRoles 选中的角色列表
 * @returns 创建的账户列表
 */
export async function saveSelectedRoles(
  cred: string,
  token: string,
  userId: string,
  selectedRoles: RoleDisplayInfo[]
): Promise<Account[]> {
  try {
    return await invoke('save_selected_roles', { cred, token, userId, selectedRoles });
  } catch (error) {
    logger.error('Failed to save selected roles: ' + error, "AccountService");
    throw error;
  }
}

/**
 * 获取当前选中的账户 ID
 * @returns 选中的账户 ID
 */
export async function getSelectedAccount(): Promise<string | null> {
  try {
    return await invoke('get_selected_account');
  } catch (error) {
    logger.error('Failed to get selected account: ' + error, "AccountService");
    return null;
  }
}

/**
 * 设置当前选中的账户 ID
 * @param accountId 账户 ID
 * @returns 是否成功
 */
export async function setSelectedAccount(accountId: string): Promise<boolean> {
  try {
    return await invoke('set_selected_account', { accountId });
  } catch (error) {
    logger.error('Failed to set selected account: ' + error, "AccountService");
    return false;
  }
}

/**
 * 检查并刷新指定用户的 cred
 * @param userId 用户 ID
 * @returns 新的 cred 和 token（如果刷新了），或 null（如果无需刷新）
 */
export async function checkAndRefreshCred(userId: string): Promise<[string, string] | null> {
  try {
    return await invoke('check_and_refresh_cred', { userId });
  } catch (error) {
    logger.error('Failed to check and refresh cred: ' + error, "AccountService");
    throw error;
  }
}
