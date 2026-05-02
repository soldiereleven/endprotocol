import { invoke } from '@tauri-apps/api/core';

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
  cred?: string;
  token?: string;
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
 * 获取所有账户
 * @returns 账户列表
 */
export async function getAccounts(): Promise<Account[]> {
  try {
    return await invoke('get_accounts');
  } catch (error) {
    console.error('Failed to get accounts:', error);
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
    console.error('Failed to add account:', error);
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
    console.error('Failed to logout account:', error);
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
    console.error('Failed to batch logout:', error);
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
    console.error('Failed to refresh accounts:', error);
    return {
      success: false,
      errorMessage: String(error),
      accounts: [],
      refreshTime: new Date().toISOString(),
    };
  }
}
