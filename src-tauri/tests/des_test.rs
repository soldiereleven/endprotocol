use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;

fn des_encrypt_3des(key: &str, data: &str) -> String {
    use des::cipher::{BlockEncrypt, KeyInit};
    use des::Des;

    let mut data_bytes = data.as_bytes().to_vec();

    // Zero Padding: 填充到8字节的倍数
    let pad_len = 8 - (data_bytes.len() % 8);
    if pad_len < 8 {
        data_bytes.extend(vec![0u8; pad_len]);
    }

    // 使用单 DES（与 Python 行为一致）
    let cipher = Des::new_from_slice(key.as_bytes()).expect("Invalid DES key");

    let mut out = vec![0u8; data_bytes.len()];

    for i in (0..data_bytes.len()).step_by(8) {
        cipher.encrypt_block_b2b((&data_bytes[i..i + 8]).into(), (&mut out[i..i + 8]).into());
    }

    BASE64.encode(out)
}

#[test]
fn test_des_encrypt_appid() {
    // 测试 appId 字段的加密
    let key = "uy7mzc4h";
    let data = "default";
    let encrypted = des_encrypt_3des(key, data);
    println!("DES encrypted 'default' with key 'uy7mzc4h': {}", encrypted);
    // Python 中同样的输入应该产生相同的输出
}

#[test]
fn test_des_encrypt_organization() {
    // 测试 organization 字段的加密
    let key = "78moqjfc";
    let data = "UWXspnCCJN4sfYlNfqps";
    let encrypted = des_encrypt_3des(key, data);
    println!(
        "DES encrypted 'UWXspnCCJN4sfYlNfqps' with key '78moqjfc': {}",
        encrypted
    );
}
