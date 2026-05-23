import { invoke } from '@tauri-apps/api/core';
import { logDebug, logInfo, logError } from './logger';

/**
 * 角色详情服务
 * 所有数据统一通过 query_role_data 获取，前端自行处理
 */
export class RoleDetailService {
  /**
   * 获取角色详情（通过统一查询接口 query_role_data）
   */
  async getCharDetail(roleId: string): Promise<any | null> {
    try {
      logInfo(`[RoleDetailService] Requesting char detail for: ${roleId}`);
      const result = await invoke<Record<string, any>>('query_role_data', {
        roleId,
        apiName: 'char_detail',
        paths: [],
      });
      return result?.__full__ ?? null;
    } catch (error) {
      logError(`[RoleDetailService] Failed to get char detail:`, error);
      return null;
    }
  }

  /**
   * 设置懒加载开关
   */
  async setLazyLoadEnabled(enabled: boolean): Promise<void> {
    try {
      logInfo(`[RoleDetailService] Setting lazy load to: ${enabled}`);
      await invoke('set_lazy_load_enabled', { enabled });
    } catch (error) {
      logError('[RoleDetailService] Failed to set lazy load:', error);
      throw error;
    }
  }

  /**
   * 获取懒加载状态
   */
  async isLazyLoadEnabled(): Promise<boolean> {
    try {
      const result = await invoke<boolean>('is_lazy_load_enabled');
      return result;
    } catch (error) {
      logError('[RoleDetailService] Failed to get lazy load status:', error);
      return true; // 默认返回true
    }
  }

  /**
   * 设置当前激活的角色ID
   */
  async setCurrentRoleId(roleId: string | null): Promise<void> {
    try {
      logDebug(`[RoleDetailService] Setting current role ID: ${roleId}`);
      await invoke('set_current_role_id', { roleId });
    } catch (error) {
      logError('[RoleDetailService] Failed to set current role ID:', error);
    }
  }
}

// 导出单例
export const roleDetailService = new RoleDetailService();
