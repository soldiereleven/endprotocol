/**
 * 日志级别枚举
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * 日志配置接口
 */
export interface LoggerConfig {
  /** 是否输出到控制台 */
  enableConsole: boolean;
  /** 是否保存到本地存储 */
  enableLocalStorage: boolean;
  /** 最小日志级别 */
  minLevel: LogLevel;
  /** 最大保存的日志条数 */
  maxStorageSize: number;
}

/**
 * 日志条目接口
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: LoggerConfig = {
  enableConsole: true,
  enableLocalStorage: true,
  minLevel: LogLevel.INFO,
  maxStorageSize: 1000,
};

/**
 * 统一的日志工具类
 */
class Logger {
  private config: LoggerConfig;
  private storageKey = "app_logs";

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 获取当前时间戳字符串
   */
  private getTimestamp(): string {
    const now = new Date();
    return now.toISOString();
  }

  /**
   * 格式化日志消息
   */
  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = this.getTimestamp();
    const levelStr = LogLevel[level];
    return `[${timestamp}] [${levelStr}] ${message}`;
  }

  /**
   * 写入日志
   */
  private writeLog(level: LogLevel, message: string, data?: any): void {
    // 检查日志级别
    if (level < this.config.minLevel) {
      return;
    }

    const formattedMessage = this.formatMessage(level, message);
    const logEntry: LogEntry = {
      timestamp: this.getTimestamp(),
      level,
      message,
      data,
    };

    // 控制台输出
    if (this.config.enableConsole) {
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(formattedMessage, data || "");
          break;
        case LogLevel.INFO:
          console.info(formattedMessage, data || "");
          break;
        case LogLevel.WARN:
          console.warn(formattedMessage, data || "");
          break;
        case LogLevel.ERROR:
          console.error(formattedMessage, data || "");
          break;
      }
    }

    // 本地存储
    if (this.config.enableLocalStorage && typeof window !== "undefined") {
      this.saveToLocalStorage(logEntry);
    }
  }

  /**
   * 保存日志到本地存储
   */
  private saveToLocalStorage(entry: LogEntry): void {
    try {
      const logs = this.getLogsFromStorage();
      logs.push(entry);

      // 限制日志数量
      if (logs.length > this.config.maxStorageSize) {
        logs.splice(0, logs.length - this.config.maxStorageSize);
      }

      localStorage.setItem(this.storageKey, JSON.stringify(logs));
    } catch (error) {
      // 如果localStorage失败，静默处理
      console.error("Failed to save log to localStorage:", error);
    }
  }

  /**
   * 从本地存储获取日志
   */
  private getLogsFromStorage(): LogEntry[] {
    try {
      const logsStr = localStorage.getItem(this.storageKey);
      return logsStr ? JSON.parse(logsStr) : [];
    } catch (error) {
      console.error("Failed to read logs from localStorage:", error);
      return [];
    }
  }

  /**
   * 调试日志
   */
  debug(message: string, data?: any): void {
    this.writeLog(LogLevel.DEBUG, message, data);
  }

  /**
   * 信息日志
   */
  info(message: string, data?: any): void {
    this.writeLog(LogLevel.INFO, message, data);
  }

  /**
   * 警告日志
   */
  warn(message: string, data?: any): void {
    this.writeLog(LogLevel.WARN, message, data);
  }

  /**
   * 错误日志
   */
  error(message: string, data?: any): void {
    this.writeLog(LogLevel.ERROR, message, data);
  }

  /**
   * 获取所有保存的日志
   */
  getLogs(): LogEntry[] {
    return this.getLogsFromStorage();
  }

  /**
   * 清除所有保存的日志
   */
  clearLogs(): void {
    localStorage.removeItem(this.storageKey);
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// 创建全局日志实例
const logger = new Logger();

// 导出单例实例
export default logger;

// 导出便捷的日志函数
export const logDebug = (message: string, data?: any) => logger.debug(message, data);
export const logInfo = (message: string, data?: any) => logger.info(message, data);
export const logWarn = (message: string, data?: any) => logger.warn(message, data);
export const logError = (message: string, data?: any) => logger.error(message, data);
