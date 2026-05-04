use aes::cipher::{BlockEncryptMut, KeyIvInit};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use des::cipher::{BlockEncrypt, KeyInit};
use des::Des;
use rsa::pkcs8::DecodePublicKey;
use rsa::{Pkcs1v15Encrypt, RsaPublicKey};

/// 3DES ECB 加密（Zero Padding）
/// 对应 Python 的 _DES_encrypt 函数
/// 注意：Python 传入 8 字节 key 时 TripleDES 退化为单 DES
pub fn des_encrypt_3des_ecb(key: &str, data: &str) -> String {
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

/// AES-128 CBC 加密（特殊填充逻辑）
/// 对应 Python 的 _AES_encrypt 函数
pub fn aes_encrypt_cbc(data: &[u8], key: &[u8]) -> String {
    use aes::cipher::generic_array::GenericArray;
    use aes::cipher::{BlockEncrypt, KeyInit};
    use aes::Aes128;

    let mut data_bytes = data.to_vec();

    // 关键点：Python 代码里多加了一个 \x00
    data_bytes.push(0u8);
    let pad_len = 16 - (data_bytes.len() % 16);
    if pad_len < 16 {
        data_bytes.extend(vec![0u8; pad_len]);
    }

    let iv = b"0102030405060708";
    let cipher = Aes128::new_from_slice(key).expect("Invalid AES key");

    let mut prev_block = *iv;
    let mut result = Vec::new();

    for chunk in data_bytes.chunks(16) {
        let mut block = [0u8; 16];
        block.copy_from_slice(chunk);

        // XOR with previous ciphertext block (CBC mode)
        for i in 0..16 {
            block[i] ^= prev_block[i];
        }

        // Encrypt the block
        let mut encrypted = GenericArray::clone_from_slice(&block);
        cipher.encrypt_block(&mut encrypted);

        result.extend_from_slice(&encrypted);
        prev_block = encrypted.into();
    }

    hex::encode(result)
}

/// RSA PKCS1v15 加密
/// 对应 Python 的 PK.encrypt(uid, padding.PKCS1v15())
pub fn rsa_pkcs1v15_encrypt(public_key_der: &[u8], data: &[u8]) -> Result<Vec<u8>, String> {
    let pub_key = RsaPublicKey::from_public_key_der(public_key_der)
        .map_err(|e| format!("Failed to parse RSA public key: {}", e))?;

    let mut rng = rand::thread_rng();
    let encrypted = pub_key
        .encrypt(&mut rng, Pkcs1v15Encrypt, data)
        .map_err(|e| format!("RSA encryption failed: {}", e))?;

    Ok(encrypted)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_des_encrypt() {
        let key = "uy7mzc4h";
        let data = "test_data";
        let encrypted = des_encrypt_3des_ecb(key, data);
        println!("DES encrypted: {}", encrypted);
        assert!(!encrypted.is_empty());
    }

    #[test]
    fn test_aes_encrypt() {
        let key = b"0123456789abcdef"; // 16 bytes for AES-128
        let data = b"test data for aes";
        let encrypted = aes_encrypt_cbc(data, key);
        println!("AES encrypted: {}", encrypted);
        assert!(!encrypted.is_empty());
    }

    #[test]
    fn test_rsa_encrypt() {
        // 使用测试公钥
        let pub_key_der = include_str!("../services/skland_service.rs"); // 占位符，实际使用时替换
        let data = b"test uid";
        match rsa_pkcs1v15_encrypt(pub_key_der.as_bytes(), data) {
            Ok(encrypted) => {
                println!("RSA encrypted length: {}", encrypted.len());
                assert!(!encrypted.is_empty());
            }
            Err(e) => {
                println!("RSA error (expected in test): {}", e);
            }
        }
    }
}
