import gzip
import json
import time
import uuid
import base64
import hashlib
import asyncio
from httpx import AsyncClient
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers.base import Cipher
from cryptography.hazmat.primitives.ciphers.algorithms import AES
from cryptography.hazmat.primitives.ciphers.modes import CBC, ECB
from cryptography.hazmat.decrepit.ciphers.algorithms import TripleDES

# --- 基础配置 ---
SM_CONFIG = {
    "organization": "UWXspnCCJN4sfYlNfqps",
    "appId": "default",
    "publicKey": "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCmxMNr7n8ZeT0tE1R9j/mPixoinPkeM+k4VGIn/s0k7N5rJAfnZ0eMER+QhwFvshzo0LNmeUkpR8uIlU/GEVr8mN28sKmwd2gpygqj0ePnBmOW4v0ZVwbSYK+izkhVFk2V/doLoMbWy6b+UnA8mkjvg0iYWRByfRsK2gdl7llqCwIDAQAB",
}
DES_RULE = {
    "appId": {"cipher": "DES", "is_encrypt": 1, "key": "uy7mzc4h", "obfuscated_name": "xx"},
    "box": {"is_encrypt": 0, "obfuscated_name": "jf"},
    "canvas": {"cipher": "DES", "is_encrypt": 1, "key": "snrn887t", "obfuscated_name": "yk"},
    "clientSize": {"cipher": "DES", "is_encrypt": 1, "key": "cpmjjgsu", "obfuscated_name": "zx"},
    "organization": {"cipher": "DES", "is_encrypt": 1, "key": "78moqjfc", "obfuscated_name": "dp"},
    "os": {"cipher": "DES", "is_encrypt": 1, "key": "je6vk6t4", "obfuscated_name": "pj"},
    "platform": {"cipher": "DES", "is_encrypt": 1, "key": "pakxhcd2", "obfuscated_name": "gm"},
    "plugins": {"cipher": "DES", "is_encrypt": 1, "key": "v51m3pzl", "obfuscated_name": "kq"},
    "pmf": {"cipher": "DES", "is_encrypt": 1, "key": "2mdeslu3", "obfuscated_name": "vw"},
    "protocol": {"is_encrypt": 0, "obfuscated_name": "protocol"},
    "referer": {"cipher": "DES", "is_encrypt": 1, "key": "y7bmrjlc", "obfuscated_name": "ab"},
    "res": {"cipher": "DES", "is_encrypt": 1, "key": "whxqm2a7", "obfuscated_name": "hf"},
    "rtype": {"cipher": "DES", "is_encrypt": 1, "key": "x8o2h2bl", "obfuscated_name": "lo"},
    "sdkver": {"cipher": "DES", "is_encrypt": 1, "key": "9q3dcxp2", "obfuscated_name": "sc"},
    "status": {"cipher": "DES", "is_encrypt": 1, "key": "2jbrxxw4", "obfuscated_name": "an"},
    "subVersion": {"cipher": "DES", "is_encrypt": 1, "key": "eo3i2puh", "obfuscated_name": "ns"},
    "svm": {"cipher": "DES", "is_encrypt": 1, "key": "fzj3kaeh", "obfuscated_name": "qr"},
    "time": {"cipher": "DES", "is_encrypt": 1, "key": "q2t3odsk", "obfuscated_name": "nb"},
    "timezone": {"cipher": "DES", "is_encrypt": 1, "key": "1uv05lj5", "obfuscated_name": "as"},
    "tn": {"cipher": "DES", "is_encrypt": 1, "key": "x9nzj1bp", "obfuscated_name": "py"},
    "trees": {"cipher": "DES", "is_encrypt": 1, "key": "acfs0xo4", "obfuscated_name": "pi"},
    "ua": {"cipher": "DES", "is_encrypt": 1, "key": "k92crp1t", "obfuscated_name": "bj"},
    "url": {"cipher": "DES", "is_encrypt": 1, "key": "y95hjkoo", "obfuscated_name": "cf"},
    "version": {"is_encrypt": 0, "obfuscated_name": "version"},
    "vpw": {"cipher": "DES", "is_encrypt": 1, "key": "r9924ab5", "obfuscated_name": "ca"},
}

PK = serialization.load_der_public_key(
    base64.b64decode(SM_CONFIG["publicKey"]))

# --- 加密工具 ---


def _DES_encrypt(key, data):
    c = Cipher(TripleDES(key.encode()), ECB())
    d = data.encode()
    d += b"\x00" * (8 - (len(d) % 8))
    return base64.b64encode(c.encryptor().update(d)).decode()


def _AES_encrypt(data, key):
    iv = b"0102030405060708"
    data += b"\x00"
    data += b"\x00" * (16 - (len(data) % 16))
    c = Cipher(AES(key), CBC(iv))
    return c.encryptor().update(data).hex()

# --- 核心逻辑 ---


async def get_did():
    uid = str(uuid.uuid4()).encode()
    pri_id = hashlib.md5(uid).hexdigest()[:16]
    ep = base64.b64encode(PK.encrypt(uid, padding.PKCS1v15())).decode()

    curr_ms = int(time.time() * 1000)
    target = {
        "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0",
        "platform": "Win32", "url": "https://www.skland.com/", "os": "web", "rtype": "all",
        "smid": f"{time.strftime('%Y%m%d%H%M%S')}{hashlib.md5(str(uuid.uuid4()).encode()).hexdigest()}00",
        "vpw": str(uuid.uuid4()), "svm": curr_ms, "trees": str(uuid.uuid4()), "pm_f": curr_ms,
        "appId": "default", "organization": SM_CONFIG["organization"], "protocol": 102, "version": "3.0.0"
    }
    # 模拟简单的 tn 拼接并 DES 混淆
    obfuscated = {DES_RULE[k]["obfuscated_name"]: (_DES_encrypt(DES_RULE[k]["key"], str(
        v)) if DES_RULE[k]["is_encrypt"] else v) for k, v in target.items() if k in DES_RULE}

    json_data = json.dumps(obfuscated, separators=(',', ':')).encode()
    aes_data = _AES_encrypt(base64.b64encode(
        gzip.compress(json_data, mtime=0)), pri_id.encode())

    async with AsyncClient() as client:
        r = await client.post("https://fp-it.portal101.cn/deviceprofile/v4", json={"appId": "default", "compress": 2, "data": aes_data, "encode": 5, "ep": ep, "organization": SM_CONFIG["organization"], "os": "web"})
        result = r.json()
        print(f"Response code: {result.get('code')}")
        did = "B" + result["detail"]["deviceId"]
        print(f"dId: {did}")
        print(f"dId ends with '==': {did.endswith('==')}")
        return did


async def main():
    # 1. 获取设备 ID
    did = await get_did()
    print(f"Using dId: {did}")

if __name__ == "__main__":
    asyncio.run(main())
