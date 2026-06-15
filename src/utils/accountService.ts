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
 * @returns 是否成功
 */
export async function logoutAccount(accountId: string): Promise<boolean> {
  try {
    return await invoke('logout_account', { accountId });
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
