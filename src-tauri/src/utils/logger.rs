use chrono::Local;
use serde::Serialize;
use std::collections::VecDeque;
use std::fs::{File, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;

use super::paths;

/// 日志级别
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize)]
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
            LogLevel::Debug => "\x1b[36m",
            LogLevel::Info => "\x1b[32m",
            LogLevel::Warn => "\x1b[33m",
            LogLevel::Error => "\x1b[31m",
        }
    }
}

/// 统一的日志条目（可序列化给前端）
#[derive(Debug, Clone, Serialize)]
pub struct LogEntry {
    pub timestamp: String,
    pub level: LogLevel,
    pub module: String,
    pub message: String,
    pub source: String,
}

/// 日志配置
pub struct LoggerConfig {
    pub log_to_console: bool,
    pub log_to_file: bool,
    pub log_level: LogLevel,
    pub log_dir: PathBuf,
    pub max_memory_entries: usize,
}

impl Default for LoggerConfig {
    fn default() -> Self {
        Self {
            log_to_console: true,
            log_to_file: true,
            log_level: LogLevel::Debug,
            log_dir: paths::log_dir()
                .unwrap_or_else(|_| std::env::current_dir().unwrap().join("logs")),
            max_memory_entries: 5000,
        }
    }
}

/// 统一日志管理器
pub struct Logger {
    config: LoggerConfig,
    log_file: Mutex<Option<File>>,
    memory_buffer: Mutex<VecDeque<LogEntry>>,
}

impl Logger {
    pub fn new(config: LoggerConfig) -> Result<Self, Box<dyn std::error::Error>> {
        let mut logger = Self {
            config,
            log_file: Mutex::new(None),
            memory_buffer: Mutex::new(VecDeque::new()),
        };

        if logger.config.log_to_file {
            logger.init_log_file()?;
        }

        Ok(logger)
    }

    fn init_log_file(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        std::fs::create_dir_all(&self.config.log_dir)?;
        let date = Local::now().format("%Y-%m-%d");
        let log_file_path = self.config.log_dir.join(format!("app-{}.log", date));
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_file_path)?;
        *self.log_file.lock().unwrap() = Some(file);
        Ok(())
    }

    fn format_timestamp() -> String {
        Local::now().format("%Y-%m-%d %H:%M:%S%.3f").to_string()
    }

    fn format_message(level: LogLevel, module: &str, message: &str) -> String {
        let ts = Self::format_timestamp();
        format!("[{}] [{}] [{}] {}", ts, level.as_str(), module, message)
    }

    fn write_log(&self, level: LogLevel, module: &str, message: &str) {
        let entry = LogEntry {
            timestamp: Self::format_timestamp(),
            level,
            module: module.to_string(),
            message: message.to_string(),
            source: "backend".to_string(),
        };

        // 内存缓冲区
        {
            let mut buf = self.memory_buffer.lock().unwrap();
            buf.push_back(entry.clone());
            if buf.len() > self.config.max_memory_entries {
                buf.pop_front();
            }
        }

        let formatted = format!("[{}] [{}] [{}] {}", entry.timestamp, level.as_str(), module, message);

        // 控制台输出（带颜色）
        if self.config.log_to_console && level >= self.config.log_level {
            let color = level.color_code();
            let reset = "\x1b[0m";
            eprintln!("{}{}{}", color, formatted, reset);
        }

        // 文件输出（无颜色）
        if self.config.log_to_file {
            if let Ok(mut file_guard) = self.log_file.lock() {
                if let Some(ref mut file) = *file_guard {
                    let _ = writeln!(file, "{}", formatted);
                    let _ = file.flush();
                }
            }
        }
    }

    /// 获取当前内存中的所有日志
    pub fn get_recent_logs(&self) -> Vec<LogEntry> {
        let buf = self.memory_buffer.lock().unwrap();
        buf.iter().cloned().collect()
    }

    pub fn debug(&self, message: &str) {
        self.write_log(LogLevel::Debug, "backend", message);
    }

    pub fn info(&self, message: &str) {
        self.write_log(LogLevel::Info, "backend", message);
    }

    pub fn warn(&self, message: &str) {
        self.write_log(LogLevel::Warn, "backend", message);
    }

    pub fn error(&self, message: &str) {
        self.write_log(LogLevel::Error, "backend", message);
    }

    pub fn debug_fmt(&self, fmt: std::fmt::Arguments) {
        self.write_log(LogLevel::Debug, "backend", &fmt.to_string());
    }

    pub fn info_fmt(&self, fmt: std::fmt::Arguments) {
        self.write_log(LogLevel::Info, "backend", &fmt.to_string());
    }

    pub fn warn_fmt(&self, fmt: std::fmt::Arguments) {
        self.write_log(LogLevel::Warn, "backend", &fmt.to_string());
    }

    pub fn error_fmt(&self, fmt: std::fmt::Arguments) {
        self.write_log(LogLevel::Error, "backend", &fmt.to_string());
    }

    /// 带模块名的调试日志
    pub fn debug_with_module(&self, module: &str, message: &str) {
        self.write_log(LogLevel::Debug, module, message);
    }

    pub fn info_with_module(&self, module: &str, message: &str) {
        self.write_log(LogLevel::Info, module, message);
    }

    pub fn warn_with_module(&self, module: &str, message: &str) {
        self.write_log(LogLevel::Warn, module, message);
    }

    pub fn error_with_module(&self, module: &str, message: &str) {
        self.write_log(LogLevel::Error, module, message);
    }
}

/// 全局日志实例
static mut GLOBAL_LOGGER: Option<Logger> = None;

pub fn init_logger() -> Result<(), Box<dyn std::error::Error>> {
    let config = LoggerConfig::default();
    let logger = Logger::new(config)?;
    unsafe {
        GLOBAL_LOGGER = Some(logger);
    }
    get_logger().info("Logger initialized successfully");
    Ok(())
}

pub fn get_logger() -> &'static Logger {
    unsafe {
        GLOBAL_LOGGER
            .as_ref()
            .expect("Logger not initialized. Call init_logger() first.")
    }
}

/// 便捷宏
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

/// 带模块名的宏
#[macro_export]
macro_rules! log_debug_module {
    ($module:expr, $($arg:tt)*) => {
        $crate::utils::logger::get_logger().debug_with_module($module, &format_args!($($arg)*).to_string())
    };
}

#[macro_export]
macro_rules! log_info_module {
    ($module:expr, $($arg:tt)*) => {
        $crate::utils::logger::get_logger().info_with_module($module, &format_args!($($arg)*).to_string())
    };
}

#[macro_export]
macro_rules! log_warn_module {
    ($module:expr, $($arg:tt)*) => {
        $crate::utils::logger::get_logger().warn_with_module($module, &format_args!($($arg)*).to_string())
    };
}

#[macro_export]
macro_rules! log_error_module {
    ($module:expr, $($arg:tt)*) => {
        $crate::utils::logger::get_logger().error_with_module($module, &format_args!($($arg)*).to_string())
    };
}
