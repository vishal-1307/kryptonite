#!/usr/bin/env python3
"""
Kryptonite - SHA-256 implemented by hand (Python 3, standard library only).

EDUCATIONAL CODE ONLY. This follows FIPS 180-4 step by step for teaching; it is
slow and not hardened. In real programs use hashlib.sha256 (see sha256_lib.py).
SHA-256 alone is not a password hash (use Argon2/bcrypt/scrypt) and not a MAC
(use HMAC-SHA-256).

Usage:
    python3 sha256.py              # sample: "abc"
    python3 sha256.py "hello"
Output: the 64-hex-character digest of the UTF-8 bytes of the text.
"""
import sys

K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]
H0 = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]
M32 = 0xFFFFFFFF


def rotr(x: int, n: int) -> int:
    """Rotate a 32-bit word right by n bits."""
    return ((x >> n) | (x << (32 - n))) & M32


def pad(msg: bytes) -> bytes:
    """Append 0x80, zeros, and the 64-bit big-endian bit length so the total is a multiple of 64 bytes."""
    bit_len = len(msg) * 8
    out = msg + b"\x80"
    while len(out) % 64 != 56:
        out += b"\x00"
    return out + bit_len.to_bytes(8, "big")


def message_schedule(block: bytes):
    """W0..W15 from the block, then Wt = s1(Wt-2) + Wt-7 + s0(Wt-15) + Wt-16."""
    W = [int.from_bytes(block[4 * t:4 * t + 4], "big") for t in range(16)]
    for t in range(16, 64):
        s0 = rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >> 3)
        s1 = rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >> 10)
        W.append((W[t - 16] + s0 + W[t - 7] + s1) & M32)
    return W


def compress(H, block: bytes):
    """64 rounds on the working registers a..h, then add them to H (feed-forward)."""
    W = message_schedule(block)
    a, b, c, d, e, f, g, h = H
    for t in range(64):
        S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
        ch = (e & f) ^ (~e & g)
        T1 = (h + S1 + ch + K[t] + W[t]) & M32
        S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
        maj = (a & b) ^ (a & c) ^ (b & c)
        T2 = (S0 + maj) & M32
        h, g, f, e, d, c, b, a = g, f, e, (d + T1) & M32, c, b, a, (T1 + T2) & M32
    return [(x + y) & M32 for x, y in zip(H, [a, b, c, d, e, f, g, h])]


def sha256(msg: bytes) -> str:
    H = H0[:]
    p = pad(msg)
    for off in range(0, len(p), 64):
        H = compress(H, p[off:off + 64])
    return "".join(f"{x:08x}" for x in H)


if __name__ == "__main__":
    text = sys.argv[1] if len(sys.argv) > 1 else "abc"
    print(sha256(text.encode("utf-8")))
