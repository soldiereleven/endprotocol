import { CharDetailData } from '@/types/charDetail';
import { logDebug } from './logger';

class CharDetailCache {
  private cache: Map<string, CharDetailData> = new Map();
  private lastUpdateTime: Map<string, number> = new Map();
  
  /**
   * 缓存角色详情数据
   */
  cacheCharDetail(roleId: string, data: CharDetailData): void {
    const now = Date.now();
    this.cache.set(roleId, data);
    this.lastUpdateTime.set(roleId, now);
    logDebug(`[CharDetailCache] Cached char detail for role: ${roleId}`);
  }
  
  /**
   * 获取角色详情
   */
  getCharDetail(roleId: string): CharDetailData | undefined {
    return this.cache.get(roleId);
  }
  
  /**
   * 获取所有缓存的角色详情
   */
  getAllCharDetails(): Map<string, CharDetailData> {
    return new Map(this.cache);
  }
  
  /**
   * 移除缓存
   */
  removeCharDetail(roleId: string): void {
    this.cache.delete(roleId);
    this.lastUpdateTime.delete(roleId);
    logDebug(`[CharDetailCache] Removed char detail for role: ${roleId}`);
  }
  
  /**
   * 清空所有缓存
   */
  clearCache(): void {
    this.cache.clear();
    this.lastUpdateTime.clear();
    logDebug('[CharDetailCache] Cache cleared');
  }
  
  /**
   * 检查是否需要刷新（超过 5 分钟）
   */
  needsRefresh(roleId: string): boolean {
    const lastUpdate = this.lastUpdateTime.get(roleId);
    if (!lastUpdate) return true;
    
    const FIVE_MINUTES = 5 * 60 * 1000;
    return (Date.now() - lastUpdate) > FIVE_MINUTES;
  }
}

export const charDetailCache = new CharDetailCache();
