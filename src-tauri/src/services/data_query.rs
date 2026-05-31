use serde::{Deserialize, Serialize};
use std::fmt;

/// 支持的 API 类型枚举
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum DataApi {
    /// 角色详情
    CharDetail,
    /// 角色 Wiki 列表
    CharWikiList,
}

impl fmt::Display for DataApi {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DataApi::CharDetail => write!(f, "char_detail"),
            DataApi::CharWikiList => write!(f, "char_wiki_list"),
        }
    }
}

impl std::str::FromStr for DataApi {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "char_detail" => Ok(DataApi::CharDetail),
            "char_wiki_list" => Ok(DataApi::CharWikiList),
            _ => Err(format!("Unknown API: {}", s)),
        }
    }
}

/// 数据路径段，支持字段名和数组索引
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PathSegment {
    /// 对象字段名
    Field(String),
    /// 数组索引
    Index(usize),
}

impl fmt::Display for PathSegment {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PathSegment::Field(name) => write!(f, "{}", name),
            PathSegment::Index(idx) => write!(f, "[{}]", idx),
        }
    }
}

/// 解析点分路径字符串为路径段列表
/// 支持格式: "base.name", "chars.0.charData.id", "chars.[0].name"
pub fn parse_path(path: &str) -> Vec<PathSegment> {
    if path.is_empty() {
        return vec![];
    }

    let mut segments = Vec::new();
    let parts: Vec<&str> = path.split('.').collect();

    for part in parts {
        if part.is_empty() {
            continue;
        }

        // 检查是否是数组索引格式 [n]
        if part.starts_with('[') && part.ends_with(']') {
            if let Ok(idx) = part[1..part.len() - 1].parse::<usize>() {
                segments.push(PathSegment::Index(idx));
                continue;
            }
        }

        // 检查是否是纯数字（数组索引的简写）
        if let Ok(idx) = part.parse::<usize>() {
            segments.push(PathSegment::Index(idx));
            continue;
        }

        // 默认作为字段名
        segments.push(PathSegment::Field(part.to_string()));
    }

    segments
}

/// 根据路径段从 JSON Value 中提取值
pub fn get_value_by_path(
    value: &serde_json::Value,
    segments: &[PathSegment],
) -> Option<serde_json::Value> {
    if segments.is_empty() {
        return Some(value.clone());
    }

    let mut current = value;

    for segment in segments {
        current = match (current, segment) {
            // 对象字段访问
            (serde_json::Value::Object(obj), PathSegment::Field(field)) => obj.get(field)?,
            // 数组索引访问
            (serde_json::Value::Array(arr), PathSegment::Index(idx)) => arr.get(*idx)?,
            // 类型不匹配
            _ => return None,
        };
    }

    Some(current.clone())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_parse_path_simple() {
        let segments = parse_path("base.name");
        assert_eq!(segments.len(), 2);
        assert_eq!(segments[0], PathSegment::Field("base".to_string()));
        assert_eq!(segments[1], PathSegment::Field("name".to_string()));
    }

    #[test]
    fn test_parse_path_with_index() {
        let segments = parse_path("chars.0.charData");
        assert_eq!(segments.len(), 3);
        assert_eq!(segments[0], PathSegment::Field("chars".to_string()));
        assert_eq!(segments[1], PathSegment::Index(0));
        assert_eq!(segments[2], PathSegment::Field("charData".to_string()));
    }

    #[test]
    fn test_parse_path_bracket_notation() {
        let segments = parse_path("chars.[0].name");
        assert_eq!(segments.len(), 3);
        assert_eq!(segments[0], PathSegment::Field("chars".to_string()));
        assert_eq!(segments[1], PathSegment::Index(0));
        assert_eq!(segments[2], PathSegment::Field("name".to_string()));
    }

    #[test]
    fn test_get_value_by_path() {
        let data = json!({
            "base": {
                "name": "TestUser",
                "level": 50
            },
            "chars": [
                {
                    "charData": {
                        "id": "char_001",
                        "name": "Character1"
                    }
                },
                {
                    "charData": {
                        "id": "char_002",
                        "name": "Character2"
                    }
                }
            ]
        });

        // 测试简单路径
        let result = get_value_by_path(&data, &parse_path("base.name"));
        assert_eq!(result, Some(json!("TestUser")));

        // 测试数组索引路径
        let result = get_value_by_path(&data, &parse_path("chars.0.charData.id"));
        assert_eq!(result, Some(json!("char_001")));

        // 测试不存在的路径
        let result = get_value_by_path(&data, &parse_path("base.nonexistent"));
        assert_eq!(result, None);

        // 测试空路径（返回整个对象）
        let result = get_value_by_path(&data, &[]);
        assert_eq!(result, Some(data.clone()));
    }
}
