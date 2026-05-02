import { invoke } from '@tauri-apps/api/core';

/**
 * 获取配置值
 * @param key 配置键
 * @returns 配置值或 null
 */
export async function getConfig<T = any>(key: string): Promise<T | null> {
  try {
    const value = await invoke<any>('get_config', { key });
    return value ?? null;
  } catch (error) {
    console.warn('Failed to get config from Tauri, using localStorage fallback:', error);
    // Fallback to localStorage for development
    const value = localStorage.getItem(`config_${key}`);
    return value ? JSON.parse(value) : null;
  }
}

/**
 * 设置配置值
 * @param key 配置键
 * @param value 配置值
 */
export async function setConfig(key: string, value: any): Promise<void> {
  try {
    await invoke('set_config', { key, value });
  } catch (error) {
    console.warn('Failed to set config via Tauri, using localStorage fallback:', error);
    // Fallback to localStorage for development
    localStorage.setItem(`config_${key}`, JSON.stringify(value));
  }
}

/**
 * 删除配置项
 * @param key 配置键
 * @returns 是否成功删除
 */
export async function removeConfig(key: string): Promise<boolean> {
  try {
    return await invoke('remove_config', { key });
  } catch (error) {
    console.warn('Failed to remove config via Tauri, using localStorage fallback:', error);
    localStorage.removeItem(`config_${key}`);
    return true;
  }
}

/**
 * 获取所有配置
 * @returns 所有配置的键值对
 */
export async function getAllConfigs(): Promise<Record<string, any>> {
  try {
    return await invoke('get_all_configs');
  } catch (error) {
    console.warn('Failed to get all configs from Tauri, using localStorage fallback:', error);
    // Fallback to localStorage
    const configs: Record<string, any> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('config_')) {
        const configKey = key.substring(7);
        const value = localStorage.getItem(key);
        if (value) {
          configs[configKey] = JSON.parse(value);
        }
      }
    }
    return configs;
  }
}
