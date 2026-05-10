use chrono::Local;
use std::fs::{File, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;

/// 日志级别
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum LogLevel {
    Debug,
    Info,
    Warn,
    Error,
}

impl LogLevel {
    fn as_str(&self) -> &'static str {
        match self {
            LogLevel::Debug => "DEBUG",
            LogLevel::Info => "INFO",
            LogLevel::Warn => "WARN",
            LogLevel::Error => "ERROR",
        }
    }

    fn color_code(&self) -> &'static str {
        match self {
            LogLevel::Debug => "\x1b[36m", // Cyan
            LogLevel::Info => "\x1b[32m",  // Green
            LogLevel::Warn => "\x1b[33m",  // Yellow
            LogLevel::Error => "\x1b[31m", // Red
        }
    }
}

/// 日志配置
pub struct LoggerConfig {
    pub log_to_console: bool,
    pub log_to_file: bool,
    pub log_level: LogLevel,
    pub log_dir: PathBuf,
}

impl Default for LoggerConfig {
    fn default() -> Self {
        Self {
            log_to_console: true,
            log_to_file: true,
            log_level: LogLevel::Info,
            log_dir: dirs::data_local_dir()
                .unwrap_or_else(|| std::env::current_dir().unwrap())
                .join("cn.msk-network.endprotocol")
                .join("logs"),
        }
    }
}

/// 统一日志管理器
pub struct Logger {
    config: LoggerConfig,
    log_file: Mutex<Option<File>>,
}

impl Logger {
    /// 创建新的日志管理器实例
    pub fn new(config: LoggerConfig) -> Result<Self, Box<dyn std::error::Error>> {
        let mut logger = Self {
            config,
            log_file: Mutex::new(None),
        };

        // 如果启用文件日志，初始化日志文件
        if logger.config.log_to_file {
            logger.init_log_file()?;
        }

        Ok(logger)
    }

    /// 初始化日志文件
    fn init_log_file(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        // 确保日志目录存在
        std::fs::create_dir_all(&self.config.log_dir)?;

        // 生成日志文件名（按日期）
        let date = Local::now().format("%Y-%m-%d");
        let log_file_path = self.config.log_dir.join(format!("app-{}.log", date));

        // 以追加模式打开日志文件
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_file_path)?;

        *self.log_file.lock().unwrap() = Some(file);

        Ok(())
    }

    /// 格式化日志消息
    fn format_message(&self, level: LogLevel, message: &str) -> String {
        let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
        format!("[{}] [{}] {}", timestamp, level.as_str(), message)
    }

    /// 写入日志
    fn write_log(&self, level: LogLevel, message: &str) {
        let formatted = self.format_message(level, message);

        // 控制台输出
        if self.config.log_to_console && level >= self.config.log_level {
            let color = level.color_code();
            let reset = "\x1b[0m";
            eprintln!("{}{}{}", color, formatted, reset);
        }

        // 文件输出
        if self.config.log_to_file {
            if let Ok(mut file_guard) = self.log_file.lock() {
                if let Some(ref mut file) = *file_guard {
                    let _ = writeln!(file, "{}", formatted);
                    let _ = file.flush();
                }
            }
        }
    }

    /// 调试日志
    pub fn debug(&self, message: &str) {
        self.write_log(LogLevel::Debug, message);
    }

    /// 信息日志
    pub fn info(&self, message: &str) {
        self.write_log(LogLevel::Info, message);
    }

    /// 警告日志
    pub fn warn(&self, message: &str) {
        self.write_log(LogLevel::Warn, message);
    }

    /// 错误日志
    pub fn error(&self, message: &str) {
        self.write_log(LogLevel::Error, message);
    }

    /// 带格式的调试日志
    pub fn debug_fmt(&self, fmt: std::fmt::Arguments) {
        self.write_log(LogLevel::Debug, &fmt.to_string());
    }

    /// 带格式的信息日志
    pub fn info_fmt(&self, fmt: std::fmt::Arguments) {
        self.write_log(LogLevel::Info, &fmt.to_string());
    }

    /// 带格式的警告日志
    pub fn warn_fmt(&self, fmt: std::fmt::Arguments) {
        self.write_log(LogLevel::Warn, &fmt.to_string());
    }

    /// 带格式的错误日志
    pub fn error_fmt(&self, fmt: std::fmt::Arguments) {
        self.write_log(LogLevel::Error, &fmt.to_string());
    }
}

/// 全局日志实例（懒加载）
static mut GLOBAL_LOGGER: Option<Logger> = None;

/// 初始化全局日志器
pub fn init_logger() -> Result<(), Box<dyn std::error::Error>> {
    let config = LoggerConfig::default();
    let logger = Logger::new(config)?;

    unsafe {
        GLOBAL_LOGGER = Some(logger);
    }

    get_logger().info("Logger initialized successfully");
    Ok(())
}

/// 获取全局日志器实例
pub fn get_logger() -> &'static Logger {
    unsafe {
        GLOBAL_LOGGER
            .as_ref()
            .expect("Logger not initialized. Call init_logger() first.")
    }
}

/// 便捷的宏，用于简化日志调用
#[macro_export]
macro_rules! log_debug {
    ($($arg:tt)*) => {
        $crate::utils::logger::get_logger().debug_fmt(format_args!($($arg)*))
    };
}

#[macro_export]
macro_rules! log_info {
    ($($arg:tt)*) => {
        $crate::utils::logger::get_logger().info_fmt(format_args!($($arg)*))
    };
}

#[macro_export]
macro_rules! log_warn {
    ($($arg:tt)*) => {
        $crate::utils::logger::get_logger().warn_fmt(format_args!($($arg)*))
    };
}

#[macro_export]
macro_rules! log_error {
    ($($arg:tt)*) => {
        $crate::utils::logger::get_logger().error_fmt(format_args!($($arg)*))
    };
}
