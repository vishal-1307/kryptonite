#!/usr/bin/env python3
"""
Kryptonite - AES-128 single block, LIBRARY ROUTE (uses the `cryptography` package).

This is the optional alternative to aes128.py: instead of writing SubBytes,
ShiftRows, MixColumns and AddRoundKey by hand, it calls a vetted, constant-time
implementation (OpenSSL via `cryptography`). It reproduces Kryptonite's
single-block demo exactly, so it uses ECB on one block with NO padding.

EDUCATIONAL CODE ONLY. ECB / one raw block is NOT how AES should be used. For real
data use an authenticated mode, e.g.:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    key = AESGCM.generate_key(bit_length=128); nonce = os.urandom(12)
    ct = AESGCM(key).encrypt(nonce, plaintext, associated_data)

Install:  python3 -m pip install cryptography
Usage:    python3 aes128_lib.py [encrypt|decrypt] [hex block] [hex key]
Output:   32 hex characters.
"""
import sys

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes  # library route

SAMPLE_BLOCK = "3243f6a8885a308d313198a2e0370734"
SAMPLE_KEY = "2b7e151628aed2a6abf7158809cf4f3c"


def run(mode: str, block_hex: str, key_hex: str) -> str:
    block, key = bytes.fromhex(block_hex), bytes.fromhex(key_hex)
    if len(block) != 16 or len(key) != 16:
        raise ValueError("block and key must both be 16 bytes (32 hex characters)")
    cipher = Cipher(algorithms.AES(key), modes.ECB())  # one block only: ECB == raw block cipher
    op = cipher.encryptor() if mode == "encrypt" else cipher.decryptor()
    return (op.update(block) + op.finalize()).hex()


if __name__ == "__main__":
    a = sys.argv[1:]
    try:
        print(run(a[0] if a else "encrypt", a[1] if len(a) > 1 else SAMPLE_BLOCK, a[2] if len(a) > 2 else SAMPLE_KEY))
    except ValueError as e:
        sys.exit(f"Error: {e}")
