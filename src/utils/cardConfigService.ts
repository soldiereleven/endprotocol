import { invoke } from "@tauri-apps/api/core";
import { logDebug, logError } from "@/utils/logger";
import type { BaseCardSettings } from "@/types/card-settings";

/**
 * 统一的卡片配置管理服务
 * 
 * 所有卡片的配置都通过此服务进行读写，配置存储在 app_config.json 的 card_settings 对象下
 */
export class CardConfigService {
  /**
   * 获取卡片配置
   * @param cardId 卡片实例ID
   * @returns 卡片配置对象
   */
  static async getCardSettings<T extends BaseCardSettings = BaseCardSettings>(
    cardId: string
  ): Promise<T> {
    try {
      const config = await invoke<any>("get_card_settings", { cardId });
      return (config || {}) as T;
    } catch (error) {
      logError(`Failed to get settings for card ${cardId}:`, error);
      return {} as T;
    }
  }

  /**
   * 保存卡片配置
   * @param cardId 卡片实例ID
   * @param settings 配置对象（会与现有配置合并）
   */
  static async saveCardSettings(
    cardId: string,
    settings: Partial<BaseCardSettings>
  ): Promise<void> {
    try {
      await invoke("save_card_settings", {
        cardId,
        settings,
      });
      logDebug(`Saved settings for card ${cardId}:`, settings);
    } catch (error) {
      logError(`Failed to save settings for card ${cardId}:`, error);
      throw error;
    }
  }

  /**
   * 更新卡片配置的特定字段
   * @param cardId 卡片实例ID
   * @param key 配置键
   * @param value 配置值
   */
  static async updateCardSetting(
    cardId: string,
    key: string,
    value: any
  ): Promise<void> {
    try {
      // 先获取现有配置
      const currentSettings = await this.getCardSettings(cardId);
      
      // 更新指定字段
      const updatedSettings = {
        ...currentSettings,
        [key]: value,
      };
      
      // 保存更新后的配置
      await this.saveCardSettings(cardId, updatedSettings);
    } catch (error) {
      logError(`Failed to update setting ${key} for card ${cardId}:`, error);
      throw error;
    }
  }

  /**
   * 删除卡片配置
   * @param cardId 卡片实例ID
   */
  static async removeCardSettings(cardId: string): Promise<void> {
    try {
      await invoke("remove_card_settings", { cardId });
      logDebug(`Removed settings for card ${cardId}`);
    } catch (error) {
      logError(`Failed to remove settings for card ${cardId}:`, error);
      throw error;
    }
  }
}
