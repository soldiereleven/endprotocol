import { Account } from './accountService';

/**
 * 账户数据内存缓存服务
 * 用于在切换账户时快速读取，避免频繁API调用
 */
class AccountCacheService {
  private cache: Map<string, Account> = new Map();
  private lastUpdateTime: Map<string, number> = new Map();
  
  /**
   * 缓存账户列表
   * @param accounts 账户列表
   */
  cacheAccounts(accounts: Account[]): void {
    const now = Date.now();
    accounts.forEach(account => {
      this.cache.set(account.id, account);
      this.lastUpdateTime.set(account.id, now);
    });
    console.log('[AccountCache] Cached', accounts.length, 'accounts');
  }
  
  /**
   * 更新单个账户
   * @param account 账户信息
   */
  updateAccount(account: Account): void {
    this.cache.set(account.id, account);
    this.lastUpdateTime.set(account.id, Date.now());
    console.log('[AccountCache] Updated account:', account.nickname);
  }
  
  /**
   * 获取所有缓存的账户
   * @returns 账户列表
   */
  getAllAccounts(): Account[] {
    return Array.from(this.cache.values());
  }
  
  /**
   * 根据ID获取账户
   * @param accountId 账户ID
   * @returns 账户信息或undefined
   */
  getAccountById(accountId: string): Account | undefined {
    return this.cache.get(accountId);
  }
  
  /**
   * 移除账户缓存
   * @param accountId 账户ID
   */
  removeAccount(accountId: string): void {
    this.cache.delete(accountId);
    this.lastUpdateTime.delete(accountId);
    console.log('[AccountCache] Removed account:', accountId);
  }
  
  /**
   * 清空所有缓存
   */
  clearCache(): void {
    this.cache.clear();
    this.lastUpdateTime.clear();
    console.log('[AccountCache] Cache cleared');
  }
  
  /**
   * 获取账户最后更新时间
   * @param accountId 账户ID
   * @returns 时间戳或undefined
   */
  getLastUpdateTime(accountId: string): number | undefined {
    return this.lastUpdateTime.get(accountId);
  }
  
  /**
   * 检查账户是否需要刷新（超过5分钟）
   * @param accountId 账户ID
   * @returns 是否需要刷新
   */
  needsRefresh(accountId: string): boolean {
    const lastUpdate = this.lastUpdateTime.get(accountId);
    if (!lastUpdate) return true;
    
    const FIVE_MINUTES = 5 * 60 * 1000;
    return (Date.now() - lastUpdate) > FIVE_MINUTES;
  }
}

// 导出单例实例
export const accountCache = new AccountCacheService();
