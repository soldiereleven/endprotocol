import { invoke } from '@tauri-apps/api/core';
import { CharDetailData } from '@/types/charDetail';
import { logDebug, logInfo, logError } from './logger';

/**
 * 简化的角色详情服务
 * 前端不再管理缓存,所有数据由后端统一管理
 */
export class RoleDetailService {
  /**
   * 获取角色详情(后端会自动处理缓存)
   */
  async getCharDetail(roleId: string): Promise<CharDetailData | null> {
    try {
      logInfo(`[RoleDetailService] Requesting char detail for: ${roleId}`);
      const result = await invoke<CharDetailData | null>('get_char_detail', { roleId });
      return result;
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
