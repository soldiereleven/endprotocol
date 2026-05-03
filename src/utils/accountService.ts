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
    console.error('Failed to send verification code:', error);
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
    console.error('Failed to add account by code:', error);
    return {
      success: false,
      errorMessage: String(error),
      account: undefined,
    };
  }
}
