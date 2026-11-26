#!/usr/bin/env python3
"""
Kryptonite - AES-128, one block, implemented by hand (Python 3, standard library only).

EDUCATIONAL CODE ONLY - NOT FOR PRODUCTION. This encrypts exactly one 16-byte
block with the raw block cipher: no mode of operation (CBC/CTR/GCM), no IV or
nonce, no authentication, demo padding, and pure-Python code that is not
constant-time. For real data use a vetted library, e.g. AES-GCM from the
`cryptography` package (see aes128_lib.py) or libsodium.

The function names match the Kryptonite visualizer:
    key_expansion, sub_bytes, shift_rows, mix_columns, add_round_key
(and the inverses inv_sub_bytes, inv_shift_rows, inv_mix_columns).
State bytes are stored column-major: index = row + 4*col (FIPS-197).

Usage:
    python3 aes128.py                                         # FIPS-197 Appendix B vector
    python3 aes128.py encrypt 00112233445566778899aabbccddeeff 000102030405060708090a0b0c0d0e0f
    python3 aes128.py decrypt 69c4e0d86a7b0430d8cdb78070b4c55a 000102030405060708090a0b0c0d0e0f
    python3 aes128.py encrypt "Two One Nine Two" "Thats my Kung Fu" --format text --key-format text
    python3 aes128.py decrypt <hex> <key> --format text [--padding zero|pkcs7]

Output (same as Kryptonite): ciphertext as 32 hex characters; when decrypting
with --format text, the text (padding removed) or, if the bytes are not valid
UTF-8 / not valid PKCS#7, the raw 32-hex-character block.
"""
import re
import sys

SAMPLE_BLOCK = "3243f6a8885a308d313198a2e0370734"  # FIPS-197 Appendix B plaintext
SAMPLE_KEY = "2b7e151628aed2a6abf7158809cf4f3c"    # FIPS-197 Appendix B key


def xtime(b: int) -> int:
    """Multiply by x (i.e. 2) in GF(2^8) modulo x^8 + x^4 + x^3 + x + 1."""
    return ((b << 1) ^ (0x1B if b & 0x80 else 0)) & 0xFF


def gmul(a: int, b: int) -> int:
    """Multiply two bytes in GF(2^8) (shift-and-add)."""
    p = 0
    while b:
        if b & 1:
            p ^= a
        a = xtime(a)
        b >>= 1
    return p


def build_sbox():
    """S-box from its definition: multiplicative inverse in GF(2^8), then the affine transform (XOR 0x63)."""
    sbox, inv = [0] * 256, [0] * 256
    for x in range(256):
        y_inv = 0
        if x:
            for y in range(1, 256):
                if gmul(x, y) == 1:
                    y_inv = y
                    break
        s = y_inv
        for i in range(1, 5):
            s ^= ((y_inv << i) | (y_inv >> (8 - i))) & 0xFF
        s ^= 0x63
        sbox[x] = s
        inv[s] = x
    return sbox, inv


SBOX, INV_SBOX = build_sbox()
RCON = [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1B, 0x36]
MIX = [[2, 3, 1, 1], [1, 2, 3, 1], [1, 1, 2, 3], [3, 1, 1, 2]]
INV_MIX = [[14, 11, 13, 9], [9, 14, 11, 13], [13, 9, 14, 11], [11, 13, 9, 14]]


def sub_bytes(s):
    """Replace every byte with SBOX[byte] (the only non-linear step: confusion)."""
    return [SBOX[b] for b in s]


def inv_sub_bytes(s):
    return [INV_SBOX[b] for b in s]


def shift_rows(s):
    """Rotate row r left by r positions."""
    return [s[(i % 4) + 4 * (((i // 4) + (i % 4)) % 4)] for i in range(16)]


def inv_shift_rows(s):
    return [s[(i % 4) + 4 * (((i // 4) - (i % 4)) % 4)] for i in range(16)]


def _mix(s, M):
    out = [0] * 16
    for c in range(4):
        for r in range(4):
            v = 0
            for k in range(4):
                v ^= gmul(M[r][k], s[k + 4 * c])
            out[r + 4 * c] = v
    return out


def mix_columns(s):
    """Multiply each column by the fixed matrix (2 3 1 1 / ...) in GF(2^8): diffusion."""
    return _mix(s, MIX)


def inv_mix_columns(s):
    return _mix(s, INV_MIX)


def add_round_key(s, k):
    """XOR the state with the 16-byte round key."""
    return [a ^ b for a, b in zip(s, k)]


def key_expansion(key):
    """Expand a 16-byte key into 11 round keys (44 words): w[i] = w[i-1] ^ w[i-4], with RotWord/SubWord/Rcon every 4th word."""
    if len(key) != 16:
        raise ValueError("AES-128 needs a 16-byte key.")
    w = [list(key[4 * i:4 * i + 4]) for i in range(4)]
    for i in range(4, 44):
        temp = list(w[i - 1])
        if i % 4 == 0:
            temp = temp[1:] + temp[:1]          # RotWord
            temp = [SBOX[b] for b in temp]      # SubWord
            temp[0] ^= RCON[i // 4]             # Rcon
        w.append([a ^ b for a, b in zip(w[i - 4], temp)])
    return [w[4 * r] + w[4 * r + 1] + w[4 * r + 2] + w[4 * r + 3] for r in range(11)]


def encrypt_block(block, key):
    """FIPS-197 cipher: AddRoundKey, 9 x (SubBytes, ShiftRows, MixColumns, AddRoundKey), final round without MixColumns."""
    rk = key_expansion(key)
    s = add_round_key(list(block), rk[0])
    for rnd in range(1, 11):
        s = sub_bytes(s)
        s = shift_rows(s)
        if rnd < 10:
            s = mix_columns(s)
        s = add_round_key(s, rk[rnd])
    return s


def decrypt_block(block, key):
    """FIPS-197 inverse cipher (section 5.3)."""
    rk = key_expansion(key)
    s = add_round_key(list(block), rk[10])
    for rnd in range(1, 11):
        s = inv_shift_rows(s)
        s = inv_sub_bytes(s)
        s = add_round_key(s, rk[10 - rnd])
        if rnd < 10:
            s = inv_mix_columns(s)
    return s


def parse_hex(value: str, what: str):
    clean = re.sub(r"\s+", "", value)
    if not re.fullmatch(r"[0-9a-fA-F]*", clean):
        raise ValueError(f"{what} must be hex (0-9, a-f).")
    if len(clean) != 32:
        raise ValueError(f"{what} must be exactly 32 hex characters (16 bytes); it has {len(clean)}.")
    return list(bytes.fromhex(clean))


def parse_key(value: str, key_format: str):
    if key_format == "text":
        b = list(value.encode("utf-8"))
        if len(b) != 16:
            raise ValueError(f"A text key must be exactly 16 bytes; this one is {len(b)} bytes.")
        return b
    return parse_hex(value, "The key")


def pad_text(text: str, padding: str):
    """UTF-8 encode and pad to 16 bytes: zero bytes (demo default) or PKCS#7 (<= 15 bytes)."""
    b = list(text.encode("utf-8"))
    if not b:
        raise ValueError("Enter a message")
    if len(b) > 16:
        raise ValueError(f"The plaintext is {len(b)} bytes; this single-block demo allows at most 16 bytes.")
    if padding == "pkcs7":
        if len(b) > 15:
            raise ValueError(f"The plaintext is {len(b)} bytes. PKCS#7 always adds at least one padding byte, so the text can be at most 15 bytes. If the data is already a multiple of 16 bytes, PKCS#7 adds a whole extra block of sixteen 10 (hex) bytes. This one-block demo can't show that, so it limits text to 15 bytes.")
        n = 16 - len(b)
        return b + [n] * n
    return b + [0] * (16 - len(b))


def unpad_text(out, padding: str):
    """Remove padding and decode UTF-8 strictly; return None when that is not possible (caller prints hex)."""
    end = 16
    if padding == "pkcs7":
        n = out[15]
        if not (1 <= n <= 16 and all(x == n for x in out[16 - n:])):
            return None
        end = 16 - n
    else:
        while end > 0 and out[end - 1] == 0:
            end -= 1
    try:
        return bytes(out[:end]).decode("utf-8")
    except UnicodeDecodeError:
        return None


def run(mode, block, key, fmt="hex", key_format="hex", padding="zero") -> str:
    k = parse_key(key, key_format)
    if mode == "decrypt":
        out = decrypt_block(parse_hex(block, "The ciphertext"), k)
        if fmt == "text":
            text = unpad_text(out, padding)
            if text is not None:
                return text
        return bytes(out).hex()
    data = pad_text(block, padding) if fmt == "text" else parse_hex(block, "The plaintext")
    return bytes(encrypt_block(data, k)).hex()


def main(argv):
    opts = {"--format": "hex", "--key-format": "hex", "--padding": "zero"}
    pos = []
    i = 0
    while i < len(argv):
        if argv[i] in opts and i + 1 < len(argv):
            opts[argv[i]] = argv[i + 1]
            i += 2
        else:
            pos.append(argv[i])
            i += 1
    mode = pos[0] if len(pos) > 0 else "encrypt"
    block = pos[1] if len(pos) > 1 else SAMPLE_BLOCK
    key = pos[2] if len(pos) > 2 else SAMPLE_KEY
    try:
        print(run(mode, block, key, opts["--format"], opts["--key-format"], opts["--padding"]))
    except ValueError as e:
        sys.exit(f"Error: {e}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main(sys.argv[1:])
