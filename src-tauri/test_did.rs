use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use chrono::Utc;
use flate2::write::GzEncoder;
use flate2::Compression;
use md5::Md5;
use rsa::pkcs8::DecodePublicKey;
use rsa::{Pkcs1v15Encrypt, RsaPublicKey};
use serde_json::json;
use std::io::Write;
use uuid::Uuid;

const ORG: &str = "UWXspnCCJN4sfYlNfqps";
const PUB_KEY_DER: &str = "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCmxMNr7n8ZeT0tE1R9j/mPixoinPkeM+k4VGIn/s0k7N5rJAfnZ0eMER+QhwFvshzo0LNmeUkpR8uIlU/GEVr8mN28sKmwd2gpygqj0ePnBmOW4v0ZVwbSYK+izkhVFk2V/doLoMbWy6b+UnA8mkjvg0iYWRByfRsK2gdl7llqCwIDAQAB";

/// 3DES ECB 加密（Zero Padding）
pub fn des_encrypt_3des(key: &str, data: &str) -> Result<String, Box<dyn std::error::Error>> {
    use des::cipher::{BlockEncrypt, KeyInit};
    use des::Des;

    let mut data_bytes = data.as_bytes().to_vec();

    // Zero Padding: 填充到8字节的倍数
    let pad_len = 8 - (data_bytes.len() % 8);
    if pad_len < 8 {
        data_bytes.extend(vec![0u8; pad_len]);
    }

    // 使用单 DES（与 Python 行为一致）
    let cipher = Des::new_from_slice(key.as_bytes())?;

    let mut out = vec![0u8; data_bytes.len()];

    for i in (0..data_bytes.len()).step_by(8) {
        cipher.encrypt_block_b2b((&data_bytes[i..i + 8]).into(), (&mut out[i..i + 8]).into());
    }

    Ok(BASE64.encode(out))
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("开始测试数美设备指纹获取...");

    // 生成 uid 和 pri_id
    let uid = Uuid::new_v4().to_string();
    let pri_id = hex::encode(Md5::digest(uid.as_bytes()))[..16].to_string();

    println!("UID: {}", uid);
    println!("PRI_ID: {}", pri_id);

    // RSA 加密 uid 得到 ep
    let pub_key_bytes = BASE64.decode(PUB_KEY_DER)?;
    let rsa_pub_key = RsaPublicKey::from_public_key_der(&pub_key_bytes)?;
    let ep = {
        let mut rng = rand::thread_rng();
        let ep_bytes = rsa_pub_key.encrypt(&mut rng, Pkcs1v15Encrypt, uid.as_bytes())?;
        BASE64.encode(ep_bytes)
    };

    println!("EP length: {}", ep.len());

    // 构造指纹数据
    let curr_ms = Utc::now().timestamp_millis();
    let smid = format!(
        "{}{}00",
        Utc::now().format("%Y%m%d%H%M%S"),
        hex::encode(Md5::digest(Uuid::new_v4().to_string().as_bytes()))
    );

    let mut target = serde_json::Map::new();
    target.insert("ua".to_string(), json!("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0"));
    target.insert("platform".to_string(), json!("Win32"));
    target.insert("url".to_string(), json!("https://www.skland.com/"));
    target.insert("os".to_string(), json!("web"));
    target.insert("rtype".to_string(), json!("all"));
    target.insert("smid".to_string(), json!(smid));
    target.insert("vpw".to_string(), json!(Uuid::new_v4().to_string()));
    target.insert("svm".to_string(), json!(curr_ms));
    target.insert("trees".to_string(), json!(Uuid::new_v4().to_string()));
    target.insert("pm_f".to_string(), json!(curr_ms));
    target.insert("appId".to_string(), json!("default"));
    target.insert("organization".to_string(), json!(ORG));
    target.insert("protocol".to_string(), json!(102));
    target.insert("version".to_string(), json!("3.0.0"));

    // DES 加密规则
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
    for (field_name, key, obf_name) in &des_rules {
        if let Some(value) = target.get(*field_name) {
            let value_str = if value.is_string() {
                value.as_str().unwrap().to_string()
            } else {
                value.to_string()
            };

            let encrypted_value = if !key.is_empty() {
                des_encrypt_3des(key, &value_str)?
            } else {
                value_str
            };

            obfuscated.insert(
                obf_name.to_string(),
                serde_json::Value::String(encrypted_value),
            );
        }
    }

    let obfuscated_json = serde_json::to_string(&serde_json::Value::Object(obfuscated))?;
    println!("混淆后的JSON长度: {}", obfuscated_json.len());

    // Gzip 压缩
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(obfuscated_json.as_bytes())?;
    let compressed = encoder.finish()?;
    let base64_gzip = BASE64.encode(compressed);

    println!("Base64 Gzip长度: {}", base64_gzip.len());

    // AES-128-CBC 加密
    let mut data = base64_gzip.as_bytes().to_vec();
    data.push(0x00);
    let pad_len = 16 - (data.len() % 16);
    if pad_len < 16 {
        data.extend(vec![0u8; pad_len]);
    }

    use aes::cipher::{BlockEncrypt, KeyInit};

    let aes_key = pri_id.as_bytes();
    let iv = b"0102030405060708";
    let cipher = aes::Aes128::new_from_slice(aes_key)?;

    let mut prev_block = *iv;
    let mut result = Vec::new();

    for chunk in data.chunks(16) {
        let mut block = [0u8; 16];
        block.copy_from_slice(chunk);

        for i in 0..16 {
            block[i] ^= prev_block[i];
        }

        let mut encrypted = aes::cipher::generic_array::GenericArray::clone_from_slice(&block);
        cipher.encrypt_block(&mut encrypted);

        result.extend_from_slice(&encrypted);
        prev_block = encrypted.into();
    }

    let aes_data = hex::encode(result);
    println!("AES数据长度: {}", aes_data.len());

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

    let client = reqwest::Client::new();
    let resp = client
        .post("https://fp-it.portal101.cn/deviceprofile/v4")
        .json(&payload)
        .send()
        .await?;

    let resp_text = resp.text().await?;
    println!("数美接口响应: {}", resp_text);

    let resp_json: serde_json::Value = serde_json::from_str(&resp_text)?;

    // 检查是否有错误码
    if let Some(code) = resp_json.get("code").and_then(|c| c.as_i64()) {
        if code != 0 {
            eprintln!("❌ 数美接口返回错误码 {}: {}", code, resp_text);
            return Err(format!("数美接口返回错误码 {}", code).into());
        }
    }

    // 提取 deviceId
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
        .ok_or_else(|| format!("deviceId not found in response. Response: {}", resp_text))?;

    let did = format!("B{}", device_id);
    println!("✅ 成功获取 dId: {}", did);
    println!("dId 是否以 == 结尾: {}", did.ends_with("=="));

    Ok(())
}
