import json, hmac, hashlib

def generate_sign(token, path, body, timestamp, did):
    header_ca = {"platform": "1", "timestamp": timestamp, "dId": did, "vName": "1.45.1"}
    header_str = json.dumps(header_ca, separators=(",", ":"))
    s = path + body + timestamp + header_str
    hmac_obj = hmac.new(token.encode(), s.encode(), hashlib.sha256)
    hex_s = hmac_obj.hexdigest()
    md5_final = hashlib.md5(hex_s.encode()).hexdigest()
    return md5_final, hex_s, header_str, s

if __name__ == '__main__':
    token = '9f192562b31b3d6222a22591fda002e8'
    path = '/api/v1/game/attendance'
    body = json.dumps({"uid":45235032,"gameId":"1"}, separators=(',', ':'))
    ts = '1683100800'
    did = 'Bexampledid=='

    sign, hex_hmac, header_str, raw = generate_sign(token, path, body, ts, did)
    print('Python header json:', header_str)
    print('Python raw:', raw)
    print('Python hmac hex:', hex_hmac)
    print('Python sign:', sign)
