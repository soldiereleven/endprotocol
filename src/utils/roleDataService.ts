/**
 * 统一数据查询服务
 * 提供松耦合的数据访问接口，支持精确到JSON叶节点的查询
 * 内置内存缓存，同一查询在组件重新挂载时不会重复发起 IPC 调用
 */

import { invoke } from '@tauri-apps/api/core';
import { logDebug, logInfo, logError } from './logger';

/**
 * 查询结果类型
 * key: 请求的路径
 * value: 对应的值（如果路径不存在则为 null）
 */
export type QueryResult = Record<string, any>;

const queryCache = new Map<string, Promise<QueryResult | null>>();

function cacheKey(roleId: string, apiName: string, paths: string[]): string {
  return `${roleId}|${apiName}|${paths.join(",")}`;
}

/**
 * 角色数据服务
 */
export class RoleDataService {
  /**
   * 清除指定查询的缓存
   */
  clearCache(roleId: string, apiName: string, paths: string[] = []): void {
    queryCache.delete(cacheKey(roleId, apiName, paths));
  }

  /**
   * 清除所有缓存
   */
  clearAllCache(): void {
    queryCache.clear();
  }

  /**
   * 统一数据查询接口
   * 
   * @param roleId - 角色ID
   * @param apiName - API名称（如 'char_detail'）
   * @param paths - 路径列表，每个路径精确到JSON叶节点
   *   - 空数组表示返回完整数据
   *   - 例如: ['base.name', 'chars.0.charData.id', 'chars.0.charData.avatarSqUrl']
   * @returns 查询结果，key为路径，value为对应的值
   * 
   * @example
   * // 获取完整数据
   * const fullData = await queryData('role_123', 'char_detail', []);
   * 
   * // 获取特定字段
   * const result = await queryData('role_123', 'char_detail', [
   *   'base.name',
   *   'base.level',
   *   'chars.0.charData.id',
   *   'chars.0.charData.name'
   * ]);
   * // 返回: { 'base.name': 'Player1', 'base.level': 50, 'chars.0.charData.id': 'char_001', ... }
   */
  async queryData(
    roleId: string,
    apiName: string,
    paths: string[] = []
  ): Promise<QueryResult | null> {
    const key = cacheKey(roleId, apiName, paths);

    const pending = queryCache.get(key);
    if (pending) {
      logDebug(`[RoleDataService] Cache hit: ${key}`);
      return pending;
    }

    logInfo(
      `[RoleDataService] Querying: roleId=${roleId}, apiName=${apiName}, paths=${paths.length}`
    );

    const promise = (async (): Promise<QueryResult | null> => {
      try {
        const result = await invoke<Record<string, any>>('query_role_data', {
          roleId,
          apiName,
          paths,
        });

        logDebug(`[RoleDataService] Query successful, received ${Object.keys(result).length} paths`);
        return result;
      } catch (error) {
        queryCache.delete(key);
        logError(`[RoleDataService] Query failed:`, error);
        return null;
      }
    })();

    queryCache.set(key, promise);
    return promise;
  }

  /**
   * 获取完整的角色详情数据
   * 
   * @param roleId - 角色ID
   * @returns 完整的角色详情JSON对象
   */
  async getFullCharDetail(roleId: string): Promise<any | null> {
    const result = await this.queryData(roleId, 'char_detail', []);
    
    if (result && result.__full__) {
      return result.__full__;
    }
    
    return null;
  }

  /**
   * 获取角色基础信息
   * 
   * @param roleId - 角色ID
   * @returns 基础信息对象 { name, level, serverName, ... }
   */
  async getBaseInfo(roleId: string): Promise<any | null> {
    const result = await this.queryData(roleId, 'char_detail', ['base']);
    
    if (result && result.base) {
      return result.base;
    }
    
    return null;
  }

  /**
   * 获取角色名称
   * 
   * @param roleId - 角色ID
   * @returns 角色名称
   */
  async getRoleName(roleId: string): Promise<string | null> {
    const result = await this.queryData(roleId, 'char_detail', ['base.name']);
    
    if (result && result['base.name']) {
      return result['base.name'];
    }
    
    return null;
  }

  /**
   * 获取指定索引的干员数据
   * 
   * @param roleId - 角色ID
   * @param charIndex - 干员在数组中的索引
   * @returns 干员数据对象
   */
  async getCharacter(roleId: string, charIndex: number): Promise<any | null> {
    const result = await this.queryData(roleId, 'char_detail', [`chars.${charIndex}`]);
    
    if (result && result[`chars.${charIndex}`]) {
      return result[`chars.${charIndex}`];
    }
    
    return null;
  }

  /**
   * 获取所有干员的ID列表
   * 
   * @param roleId - 角色ID
   * @returns 干员ID数组
   */
  async getAllCharIds(roleId: string): Promise<string[]> {
    const result = await this.queryData(roleId, 'char_detail', ['chars']);
    
    if (result && result.chars && Array.isArray(result.chars)) {
      return result.chars
        .map((char: any) => char.charData?.id)
        .filter((id: string) => id !== undefined && id !== null);
    }
    
    return [];
  }

  /**
   * 批量获取多个路径的数据
   * 
   * @param roleId - 角色ID
   * @param paths - 路径列表
   * @returns 查询结果
   */
  async batchQuery(roleId: string, paths: string[]): Promise<QueryResult | null> {
    return this.queryData(roleId, 'char_detail', paths);
  }

  // ====== Wiki 相关方法 ======

  /**
   * 获取单个角色的 Wiki 详情（char_wiki_detail）
   * 
   * @param roleId - 角色ID
   * @param itemId - Wiki 物品 ID
   * @returns Wiki 详情数据
   */
  async getWikiItemDetail(roleId: string, itemId: string): Promise<any | null> {
    const result = await this.queryData(roleId, 'char_wiki_detail', [itemId]);
    if (!result) return null;
    const raw = result[itemId];
    if (!raw) return null;
    if (raw.data?.item) return raw.data.item;
    if (raw.item) return raw.item;
    return raw;
  }
}

// 导出单例
export const roleDataService = new RoleDataService();
