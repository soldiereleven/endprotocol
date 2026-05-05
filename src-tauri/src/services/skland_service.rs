use aes::cipher::{BlockEncryptMut, KeyIvInit};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use chrono::Utc;
use digest::Digest;
use flate2::Compression;
use flate2::GzBuilder;
use hmac::{Hmac, Mac};
use md5::Md5;
use rsa::pkcs8::DecodePublicKey;
use rsa::{Pkcs1v15Encrypt, RsaPublicKey};
use serde_json::json;
use sha2::Sha256;
use std::io::Write;
use uuid::Uuid;

use crate::models::role::{
    BindingInfo, BindingResponse, GameBinding, RoleDetailResponse, RoleDisplayInfo, RoleInfo,
};
use crate::services::config_service::ConfigService;
use crate::utils::{http_client, AppError};
use crate::{log_debug, log_info, log_warn, log_error};

type HmacSha256 = Hmac<Sha256>;

const ORG: &str = "UWXspnCCJN4sfYlNfqps";
const PUB_KEY_DER: &str = "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCmxMNr7n8ZeT0tE1R9j/mPixoinPkeM+k4VGIn/s0k7N5rJAfnZ0eMER+QhwFvshzo0LNmeUkpR8uIlU/GEVr8mN28sKmwd2gpygqj0ePnBmOW4v0ZVwbSYK+izkhVFk2V/doLoMbWy6b+UnA8mkjvg0iYWRByfRsK2gdl7llqCwIDAQAB";

/// Skland 服务
pub struct SklandService {
    config_service: std::sync::Arc<std::sync::Mutex<ConfigService>>,
}

impl SklandService {
    pub fn new(config_service: std::sync::Arc<std::sync::Mutex<ConfigService>>) -> Self {
        Self { config_service }
    }

    /// 获取或缓存的 dId
    async fn get_or_refresh_did(&self) -> Result<String, AppError> {
        // 尝试从配置中获取缓存的 dId
        let cached_did: Option<String> = {
            let config = self
                .config_service
                .lock()
                .map_err(|e| AppError::ConfigError {
                    message: format!("Lock failed: {}", e),
                })?;
            config.get("did_cache")
        };

        if let Some(did) = cached_did {
            return Ok(did);
        }

        // 缓存不存在，获取新的 dId
        let new_did = self.fetch_new_did().await?;

        // 保存到配置
        {
            let mut config = self
                .config_service
                .lock()
                .map_err(|e| AppError::ConfigError {
                    message: format!("Lock failed: {}", e),
                })?;
            config.set("did_cache".to_string(), json!(new_did))?;
        }

        Ok(new_did)
    }

    /// 获取新的 dId（带重试）
    async fn fetch_new_did_with_retry(&self) -> Result<String, AppError> {
        // 第一次尝试
        match self.fetch_new_did().await {
            Ok(did) => Ok(did),
            Err(_) => {
                // 第一次失败，清除缓存后重试
                {
                    let mut config =
                        self.config_service
                            .lock()
                            .map_err(|e| AppError::ConfigError {
                                message: format!("Lock failed: {}", e),
                            })?;
                    config.remove("did_cache");
                }
                // 第二次尝试
                self.fetch_new_did().await
            }
        }
    }

    /// 获取新的 dId - 1:1 复刻 Python 脚本
    async fn fetch_new_did(&self) -> Result<String, AppError> {
        // 生成 uid 和 pri_id
        let uid = Uuid::new_v4().to_string();
        let uid_bytes = uid.as_bytes();
        let pri_id = hex::encode(md5::Md5::digest(uid_bytes))[..16].to_string();

        let client = reqwest::Client::new();

        // RSA 加密 uid 得到 ep
        let pub_key_bytes = BASE64
            .decode(PUB_KEY_DER)
            .map_err(|e| AppError::AuthError {
                message: format!("Failed to decode public key: {}", e),
            })?;
        let rsa_pub_key =
            RsaPublicKey::from_public_key_der(&pub_key_bytes).map_err(|e| AppError::AuthError {
                message: format!("Failed to parse public key: {}", e),
            })?;
        let ep = {
            let mut rng = rand::thread_rng();
            let ep_bytes = rsa_pub_key
                .encrypt(&mut rng, Pkcs1v15Encrypt, uid.as_bytes())
                .map_err(|e| AppError::AuthError {
                    message: format!("RSA encryption failed: {}", e),
                })?;
            BASE64.encode(ep_bytes)
        };

        log_debug!("=== STEP 2: RSA Encryption ===");
        log_debug!("EP_BASE64: {}", ep);
        log_debug!("EP_LENGTH: {}", ep.len());

        // 构造指纹数据（与 Python 完全一致）
        let curr_ms = Utc::now().timestamp_millis();
        let smid_hash = hex::encode(md5::Md5::digest(Uuid::new_v4().to_string().as_bytes()));
        let smid = format!("{}{}00", Utc::now().format("%Y%m%d%H%M%S"), smid_hash);
        let vpw = Uuid::new_v4().to_string();
        let trees = Uuid::new_v4().to_string();

        log_debug!("=== STEP 3: Target Data ===");
        log_debug!("  curr_ms: {}", curr_ms);
        log_debug!("  smid: {}", smid);
        log_debug!("  vpw: {}", vpw);
        log_debug!("  trees: {}", trees);

        // 所有需要混淆的字段
        let mut target = serde_json::Map::new();
        target.insert("ua".to_string(), json!("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0"));
        target.insert("platform".to_string(), json!("Win32"));
        target.insert("url".to_string(), json!("https://www.skland.com/"));
        target.insert("os".to_string(), json!("web"));
        target.insert("rtype".to_string(), json!("all"));
        target.insert("smid".to_string(), json!(smid));
        target.insert("vpw".to_string(), json!(vpw));
        target.insert("svm".to_string(), json!(curr_ms));
        target.insert("trees".to_string(), json!(trees));
        target.insert("pm_f".to_string(), json!(curr_ms));
        target.insert("appId".to_string(), json!("default"));
        target.insert("organization".to_string(), json!(ORG));
        target.insert("protocol".to_string(), json!(102));
        target.insert("version".to_string(), json!("3.0.0"));

        // DES 加密规则（从 Python 代码提取）
        let des_rules = vec![
            ("appId", "uy7mzc4h", "xx"),
            ("box", "", "jf"),
            ("canvas", "snrn887t", "yk"),
            ("clientSize", "cpmjjgsu", "zx"),
            ("organization", "78moqjfc", "dp"),
            ("os", "je6vk6t4", "pj"),
            ("platform", "pakxhcd2", "gm"),
            ("plugins", "v51m3pzl", "kq"),
            ("pmf", "2mdeslu3", "vw"),
            ("protocol", "", "protocol"),
            ("referer", "y7bmrjlc", "ab"),
            ("res", "whxqm2a7", "hf"),
            ("rtype", "x8o2h2bl", "lo"),
            ("sdkver", "9q3dcxp2", "sc"),
            ("status", "2jbrxxw4", "an"),
            ("subVersion", "eo3i2puh", "ns"),
            ("svm", "fzj3kaeh", "qr"),
            ("time", "q2t3odsk", "nb"),
            ("timezone", "1uv05lj5", "as"),
            ("tn", "x9nzj1bp", "py"),
            ("trees", "acfs0xo4", "pi"),
            ("ua", "k92crp1t", "bj"),
            ("url", "y95hjkoo", "cf"),
            ("version", "", "version"),
            ("vpw", "r9924ab5", "ca"),
        ];

        // 对每个字段进行 DES 加密或保持原样
        let mut obfuscated = serde_json::Map::new();
        log_debug!("=== STEP 4: DES Obfuscation Details ===");

        // 创建 des_rules 的查找表
        let des_rules_map: std::collections::HashMap<&str, (&str, &str)> = des_rules
            .iter()
            .map(|(field, key, obf)| (*field, (*key, *obf)))
            .collect();

        // 明确按照 Python target 的字段顺序插入，以保证 JSON 键顺序一致
        let field_order = [
            "ua",
            "platform",
            "url",
            "os",
            "rtype",
            "smid",
            "vpw",
            "svm",
            "trees",
            "pm_f",
            "appId",
            "organization",
            "protocol",
            "version",
        ];

        for &field_name in &field_order {
            if let Some(value) = target.get(field_name) {
                if let Some(&(key, obf_name)) = des_rules_map.get(field_name) {
                    if !key.is_empty() {
                        // 需要 DES 加密，转换为字符串后加密
                        let value_str = if value.is_string() {
                            value.as_str().unwrap().to_string()
                        } else {
                            value.to_string()
                        };

                        let enc = des_encrypt_3des(key, &value_str)?;
                        log_debug!("DES Encrypt - Field: {}, Key: {}, ObfName: {}", field_name, key, obf_name);
                        log_debug!("  Original: {}", value_str);
                        log_debug!("  Encrypted: {}", enc);

                        obfuscated.insert(obf_name.to_string(), serde_json::Value::String(enc));
                    } else {
                        // 不需要加密，保持原始类型
                        log_debug!("Keep Original - Field: {}, ObfName: {}, Value: {}", field_name, obf_name, value);

                        obfuscated.insert(obf_name.to_string(), value.clone());
                    }
                }
            }
        }

        // 手动根据 field_order 构建 JSON 字符串以确保键顺序与 Python 完全一致
        let mut parts: Vec<String> = Vec::new();
        for &field_name in &field_order {
            if let Some(&(_key, obf_name)) = des_rules_map.get(field_name) {
                if let Some(val) = obfuscated.get(obf_name) {
                    let val_json = serde_json::to_string(val)?;
                    parts.push(format!("\"{}\":{}", obf_name, val_json));
                }
            }
        }
        let obfuscated_json = format!("{{{}}}", parts.join(","));

        log_debug!("=== STEP 5: JSON Serialization ===");
        log_debug!("JSON_LENGTH: {}", obfuscated_json.len());
        log_debug!("JSON_HEX: {}", hex::encode(obfuscated_json.as_bytes()));

        // Gzip 压缩，使用 GzBuilder 并固定 mtime=0，匹配 Python gzip.compress(..., mtime=0)
        use flate2::Compression;
        use flate2::GzBuilder;
        use std::io::Write;

        let mut encoder = GzBuilder::new()
            .mtime(0)
            .write(Vec::new(), Compression::best());
        encoder.write_all(obfuscated_json.as_bytes())?;
        let compressed = encoder.finish()?;
        let base64_gzip = BASE64.encode(&compressed);

        log_debug!("=== STEP 6: Gzip Compression ===");
        log_debug!("GZIP_LENGTH: {}", compressed.len());
        log_debug!("GZIP_BASE64_LENGTH: {}", base64_gzip.len());

        // AES-128-CBC 加密（特殊填充：先加 \x00，再补到16字节倍数）
        use aes::cipher::{BlockEncrypt, KeyInit};

        let mut data = base64_gzip.as_bytes().to_vec();
        data.push(0x00); // 关键点：先添加一个 \x00
        let pad_len = 16 - (data.len() % 16);
        if pad_len < 16 {
            data.extend(vec![0u8; pad_len]);
        }

        let aes_key = pri_id.as_bytes();
        let iv = b"0102030405060708";
        let cipher = aes::Aes128::new_from_slice(aes_key).map_err(|e| AppError::AuthError {
            message: format!("AES key error: {}", e),
        })?;

        // 手动实现 CBC 模式（与 Python 和测试代码一致）
        let mut prev_block = *iv;
        let mut result = Vec::new();

        for chunk in data.chunks(16) {
            let mut block = [0u8; 16];
            block.copy_from_slice(chunk);

            // XOR with previous ciphertext
            for i in 0..16 {
                block[i] ^= prev_block[i];
            }

            let mut encrypted = aes::cipher::generic_array::GenericArray::clone_from_slice(&block);
            cipher.encrypt_block(&mut encrypted);

            result.extend_from_slice(&encrypted);
            prev_block = encrypted.into();
        }

        let aes_data = hex::encode(result);
        log_debug!("AES data length: {}", aes_data.len());

        // 请求数美接口
        let payload = json!({
            "appId": "default",
            "compress": 2,
            "data": aes_data,
            "encode": 5,
            "ep": ep,
            "organization": ORG,
            "os": "web"
        });

        let resp = client
            .post("https://fp-it.portal101.cn/deviceprofile/v4")
            .json(&payload)
            .send()
            .await?;

        let resp_text = resp.text().await?;
        tracing::debug!("数美设备指纹响应: {}", resp_text);

        let resp_json: serde_json::Value =
            serde_json::from_str(&resp_text).map_err(|e| AppError::AuthError {
                message: format!("Failed to parse response as JSON: {}", e),
            })?;

        // 打印完整的响应用于调试
        log_debug!("数美接口完整响应: {}", resp_text);

        // 检查是否有错误码（注意：数美接口某些非0码也可能成功，如1100）
        // 只有当没有deviceId字段时才认为失败
        let has_device_id = resp_json
            .get("detail")
            .and_then(|d| d.get("deviceId").or_else(|| d.get("device_id")))
            .or_else(|| {
                resp_json
                    .get("data")
                    .and_then(|d| d.get("deviceId").or_else(|| d.get("device_id")))
            })
            .or_else(|| {
                resp_json
                    .get("deviceId")
                    .or_else(|| resp_json.get("device_id"))
            })
            .is_some();

        if !has_device_id {
            // 如果没有deviceId，才检查错误码
            if let Some(code) = resp_json.get("code").and_then(|c| c.as_i64()) {
                return Err(AppError::AuthError {
                    message: format!("数美接口返回错误码 {}: {}", code, resp_text),
                });
            }
        }

        // 尝试多种可能的响应结构
        let device_id = resp_json
            .get("detail")
            .and_then(|d| d.get("deviceId").or_else(|| d.get("device_id")))
            .or_else(|| {
                resp_json
                    .get("data")
                    .and_then(|d| d.get("deviceId").or_else(|| d.get("device_id")))
            })
            .or_else(|| {
                resp_json
                    .get("deviceId")
                    .or_else(|| resp_json.get("device_id"))
            })
            .and_then(|id| id.as_str())
            .ok_or_else(|| AppError::AuthError {
                message: format!("deviceId not found in response. Response: {}", resp_text),
            })?;

        Ok(format!("B{}", device_id))
    }

    /// 计算森空岛特定的 Sign
    fn calculate_sign(&self, path: &str, body: &str, ts: &str, did: &str, token: &str) -> String {
        // 构造 header JSON 字符串（按 Python 的键顺序和紧凑格式）
        let h_ca_str = format!(
            "{{\"platform\":\"1\",\"timestamp\":\"{}\",\"dId\":\"{}\",\"vName\":\"1.45.1\"}}",
            ts, did
        );

        // 1. 拼接原始字符串: path + body + ts + header_json
        let raw_data = format!("{}{}{}{}", path, body, ts, h_ca_str);

        // Debug: print the exact inputs used to compute the sign
        log_debug!("calculate_sign header_json: {}", h_ca_str);
        log_debug!("calculate_sign raw: {}", raw_data);

        // 2. HMAC-SHA256
        let mut mac = HmacSha256::new_from_slice(token.as_bytes()).expect("HMAC key error");
        mac.update(raw_data.as_bytes());
        let hmac_res = hex::encode(mac.finalize().into_bytes());

        log_debug!("calculate_sign hex_hmac: {}", hmac_res);

        // 3. MD5
        let digest = Md5::digest(hmac_res.as_bytes());
        let md5_hex = format!("{:x}", digest);
        log_debug!("calculate_sign md5: {}", md5_hex);

        md5_hex
    }

    /// 构建通用的 Skland HTTP 请求
    fn build_skland_request(
        &self,
        client: &reqwest::Client,
        method: &str,
        url: &str,
        cred: &str,
        did: &str,
        sign: &str,
        ts: &str,
    ) -> reqwest::RequestBuilder {
        let request = if method == "GET" {
            client.get(url)
        } else {
            client.post(url)
        };

        request
            .header("cred", cred)
            .header("dId", did)
            .header("sign", sign)
            .header("timestamp", ts)
            .header("platform", "1")
            .header("vName", "1.45.1")
            .header("Content-Type", "application/json")
            .header("Origin", "https://game.skland.com")
            .header("Referer", "https://game.skland.com/")
            .header("X-Requested-With", "com.hypergryph.skland")
            .header(
                "User-Agent",
                "Mozilla/5.0 (Linux; Android 12; PHY110 Build/V417IR; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/110.0.5481.154 Safari/537.36; SKLand/1.54.0",
            )
    }

    /// 获取玩家绑定列表
    pub async fn get_player_binding(
        &self,
        cred: &str,
        token: &str,
    ) -> Result<Vec<GameBinding>, AppError> {
        let path = "/api/v1/game/player/binding";
        let body = "";
        let url = format!("https://zonai.skland.com{}", path);

        let client = http_client::create_client();

        // Try up to two attempts: first use cached did; on failure clear cache and fetch new did once.
        let mut last_err: Option<AppError> = None;
        for attempt in 0..2 {
            let did = if attempt == 0 {
                // use cached or fetch
                match self.get_or_refresh_did().await {
                    Ok(d) => d,
                    Err(e) => {
                        last_err = Some(e);
                        continue;
                    }
                }
            } else {
                // clear cache and fetch fresh did
                {
                    let mut config = self
                        .config_service
                        .lock()
                        .map_err(|e| AppError::ConfigError { message: format!("Lock failed: {}", e) })?;
                    config.remove("did_cache");
                }
                match self.fetch_new_did().await {
                    Ok(d) => d,
                    Err(e) => {
                        last_err = Some(e);
                        continue;
                    }
                }
            };

            let ts = (Utc::now().timestamp()).to_string();
            let sign = self.calculate_sign(path, body, &ts, &did, token);

            // 调试：打印认证信息
            log_debug!("=== Binding List Request Debug (attempt {}) ===", attempt + 1);
            log_debug!("cred length: {}", cred.len());
            log_debug!(
                "cred first 20 chars: {}",
                if cred.len() >= 20 { &cred[..20] } else { cred }
            );
            log_debug!("dId: {}", did);
            log_debug!("sign: {}", sign);
            log_debug!("timestamp: {}", ts);

            let response = self
                .build_skland_request(&client, "GET", &url, cred, &did, &sign, &ts)
                .send()
                .await;

            let response = match response {
                Ok(r) => r,
                Err(e) => {
                    last_err = Some(AppError::AuthError { message: format!("HTTP request failed: {}", e) });
                    continue;
                }
            };

            // 调试：打印原始响应
            let status = response.status();
            let resp_text = response.text().await.map_err(|e| AppError::AuthError {
                message: format!("Failed to read response text: {}", e),
            })?;
            log_debug!("Binding list response status: {}", status);
            log_debug!("Binding list response body: {}", resp_text);

            // 解析JSON
            match serde_json::from_str::<BindingResponse>(&resp_text) {
                Ok(json) => {
                    log_debug!("JSON parsed successfully, code: {}", json.code);
                    if json.code == 0 {
                        log_debug!("Binding list parsed, returning {} games", json.data.list.len());
                        for game in &json.data.list {
                            log_debug!("  Game: app_code={}, binding_list count={}", game.app_code, game.binding_list.len());
                            for binding in &game.binding_list {
                                log_debug!("    Binding: uid={}, roles count={}", binding.uid, binding.roles.len());
                            }
                        }
                        return Ok(json.data.list);
                    } else {
                        // If server returned auth-related code, try next attempt (fresh did)
                        last_err = Some(AppError::AuthError { message: format!("Failed to get binding list: {}", json.message) });
                        continue;
                    }
                }
                Err(e) => {
                    last_err = Some(AppError::AuthError { message: format!("Failed to parse JSON: {}. Response: {}", e, resp_text) });
                    continue;
                }
            }
        }

        Err(last_err.unwrap_or(AppError::AuthError { message: "Unknown error getting binding list".to_string() }))
    }

    /// 获取角色详情（带自动重试机制）
    pub async fn get_role_detail(
        &self,
        cred: &str,
        token: &str,
        role_id: &str,
        server_id: &str,
        user_id: &str,
    ) -> Result<RoleDisplayInfo, AppError> {
        let did = self.get_or_refresh_did().await?;
        let path = "/api/v1/game/endfield/card/detail";
        let query_string = format!("roleId={}&serverId={}&userId={}", role_id, server_id, user_id);
        let url = format!("https://zonai.skland.com{}?{}", path, query_string);
        
        let client = http_client::create_client();
        
        // 时间戳：直接使用当前时间，不做偏移
        let ts = Utc::now().timestamp().to_string();
        
        // 签名：对于 GET 请求，path 不包含 query 参数，query 作为 body
        let sign = self.calculate_sign(path, &query_string, &ts, &did, token);
        
        // 构建请求
        let response = client
            .get(&url)
            .header("cred", cred)
            .header("dId", did)
            .header("sign", sign)
            .header("timestamp", ts)
            .header("platform", "1")
            .header("vName", "1.45.1")
            .header("Content-Type", "application/json")
            .header("Origin", "https://game.skland.com")
            .header("Referer", "https://game.skland.com/")
            .header("X-Requested-With", "com.hypergryph.skland")
            .header(
                "User-Agent",
                "Mozilla/5.0 (Linux; Android 12; PHY110 Build/V417IR; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/110.0.5481.154 Safari/537.36; SKLand/1.54.0",
            )
            .send()
            .await
            .map_err(|e| AppError::AuthError { message: format!("HTTP request failed: {}", e) })?;
        
        let status = response.status();
        let resp_text = response.text().await.map_err(|e| AppError::AuthError {
            message: format!("Failed to read response text: {}", e),
        })?;
        
        // 解析响应
        match serde_json::from_str::<RoleDetailResponse>(&resp_text) {
            Ok(json) =>  {
                if json.code == 0 {
                    Ok(RoleDisplayInfo {
                        role_id: role_id.to_string(),
                        user_id: user_id.to_string(),
                        server_id: server_id.to_string(),
                        nickname: json.data.detail.base.name,
                        level: json.data.detail.base.level,
                        avatar_url: json.data.detail.base.avatar_url,
                    })
                } else {
                    Err(AppError::AuthError { message: format!("API error: {}", json.message) })
                }
            }
            Err(e) => {
                Err(AppError::AuthError { message: format!("Failed to parse JSON: {}. Response: {}", e, resp_text) })
            }
        }
    }

    /// 检查 cred 是否有效
    pub async fn check_cred(&self, cred: &str) -> Result<bool, AppError> {
        let client = http_client::create_client();
        
        let response = client
            .get("https://zonai.skland.com/api/v1/user/check")
            .header("cred", cred)
            .header("Content-Type", "application/json")
            .send()
            .await
            .map_err(|e| AppError::AuthError { 
                message: format!("HTTP request failed: {}", e) 
            })?;
        
        let json: serde_json::Value = response.json().await.map_err(|e| AppError::AuthError {
            message: format!("Failed to parse response: {}", e),
        })?;
        
        // code 为 0 表示 cred 有效
        let is_valid = json.get("code").and_then(|c| c.as_i64()) == Some(0);
        Ok(is_valid)
    }

    /// 使用 hytoken 重新换取 cred 和 token
    pub async fn refresh_cred_by_hytoken(
        &self,
        hytoken: &str,
    ) -> Result<(String, String, String), AppError> {
        let client = http_client::create_client();
        
        let response = client
            .post("https://as.hypergryph.com/user/oauth2/v2/grant")
            .json(&serde_json::json!({
                "token": hytoken,
                "appCode": "4ca99fa6b56cc2ba",
                "type": 0
            }))
            .send()
            .await
            .map_err(|e| AppError::AuthError { 
                message: format!("Step 1 (OAuth grant) failed: {}", e) 
            })?;
        
        let json: serde_json::Value = response.json().await.map_err(|e| AppError::AuthError {
            message: format!("Failed to parse OAuth response: {}", e),
        })?;
        
        if json.get("status").and_then(|v| v.as_i64()) != Some(0) {
            let msg = json
                .get("msg")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown error");
            return Err(AppError::AuthError {
                message: format!("OAuth grant failed: {}", msg),
            });
        }
        
        let sk_code = json
            .get("data")
            .and_then(|d| d.get("code"))
            .and_then(|c| c.as_str())
            .ok_or_else(|| AppError::AuthError {
                message: "Code not found in OAuth response".to_string(),
            })?
            .to_string();
        
        // Step 2: 使用 sk_code 换取新的 cred 和 token
        let response = client
            .post("https://zonai.skland.com/api/v1/user/auth/generate_cred_by_code")
            .json(&serde_json::json!({
                "kind": 1,
                "code": sk_code
            }))
            .send()
            .await
            .map_err(|e| AppError::AuthError { 
                message: format!("Step 2 (generate cred) failed: {}", e) 
            })?;
        
        let json: serde_json::Value = response.json().await.map_err(|e| AppError::AuthError {
            message: format!("Failed to parse cred response: {}", e),
        })?;
        
        if json.get("code").and_then(|v| v.as_i64()) != Some(0) {
            let msg = json
                .get("message")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown error");
            return Err(AppError::AuthError {
                message: format!("Generate cred failed: {}", msg),
            });
        }
        
        let data = json.get("data").ok_or_else(|| AppError::AuthError {
            message: "Data not found in cred response".to_string(),
        })?;
        
        let cred = data
            .get("cred")
            .and_then(|v| v.as_str())
            .ok_or_else(|| AppError::AuthError {
                message: "Cred not found".to_string(),
            })?
            .to_string();
        
        let token = data
            .get("token")
            .and_then(|v| v.as_str())
            .ok_or_else(|| AppError::AuthError {
                message: "Token not found".to_string(),
            })?
            .to_string();
        
        let user_id = data
            .get("userId")
            .and_then(|v| v.as_str())
            .ok_or_else(|| AppError::AuthError {
                message: "UserId not found".to_string(),
            })?
            .to_string();
        
        Ok((cred, token, user_id))
    }

    /// 提取终末地角色列表
    pub fn extract_endfield_roles(bindings: &[GameBinding]) -> Vec<(String, String, String)> {
        let mut roles = Vec::new();

        for binding in bindings {
            if binding.app_code == "endfield" {
                for role_info in &binding.binding_list {
                    for role in &role_info.roles {
                        roles.push((
                            role_info.uid.clone(),
                            role.server_id.clone(),
                            role.role_id.clone(),
                        ));
                    }
                }
            }
        }

        roles
    }
}

/// DES 3DES 加密函数（ECB 模式，Zero Padding）
fn des_encrypt_3des(key: &str, data: &str) -> Result<String, AppError> {
    use des::cipher::{BlockEncrypt, KeyInit};
    use des::Des;

    let mut data_bytes = data.as_bytes().to_vec();

    // Zero Padding: 填充到8字节的倍数
    let pad_len = 8 - (data_bytes.len() % 8);
    if pad_len < 8 {
        data_bytes.extend(vec![0u8; pad_len]);
    }

    // 使用单 DES（与 Python 行为一致）
    let cipher = Des::new_from_slice(key.as_bytes()).map_err(|e| AppError::AuthError {
        message: format!("DES key error: {}", e),
    })?;

    let mut out = vec![0u8; data_bytes.len()];

    for i in (0..data_bytes.len()).step_by(8) {
        cipher.encrypt_block_b2b((&data_bytes[i..i + 8]).into(), (&mut out[i..i + 8]).into());
    }

    Ok(BASE64.encode(out))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_fetch_did_format() {
        // 创建一个临时的 ConfigService
        let config_service =
            std::sync::Arc::new(std::sync::Mutex::new(ConfigService::new().unwrap()));
        let service = SklandService::new(config_service);

        // 获取 dId
        let did = service.fetch_new_did().await.unwrap();

        // 验证 dId 格式
        assert!(did.starts_with("B"), "dId should start with 'B'");
        println!("Generated dId: {}", did);
        println!("dId length: {}", did.len());
        println!("dId ends with '==': {}", did.ends_with("=="));

        // dId 应该是以 == 结尾的 Base64 字符串
        assert!(did.ends_with("=="), "dId should end with '=='");
    }
}
