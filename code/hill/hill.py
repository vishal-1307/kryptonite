#!/usr/bin/env python3
"""
Kryptonite - Hill cipher, 2x2 (Python 3, standard library only).

Usage:
    python3 hill.py                         # sample: encrypt HELP with key "3 3 2 5"
    python3 hill.py encrypt "short example" HILL
    python3 hill.py decrypt HIAT "3 3 2 5"

Key: 4 whole numbers row by row (a b c d), any size (Python ints are exact),
or a 4-letter word. det(K) must be coprime with 26 (odd and not 13).
Only A-Z are used; an X pads an odd-length message.
"""
import re
import sys
from math import gcd

SAMPLE = ("encrypt", "HELP", "3 3 2 5")


def only_letters(s: str) -> str:
    return "".join(c for c in s.upper() if "A" <= c <= "Z")


def parse_key(key: str):
    """Return [[a, b], [c, d]] reduced mod 26 (exact for huge numbers)."""
    s = key.strip()
    if re.fullmatch(r"[A-Za-z]{4}", re.sub(r"\s+", "", s)):
        v = [ord(c) - 65 for c in only_letters(s)]
    else:
        parts = [p for p in re.split(r"[\s,;]+", s) if p]
        if len(parts) != 4 or not all(re.fullmatch(r"[+-]?\d+", p) for p in parts):
            raise ValueError('Key must be 4 whole numbers (e.g. "3 3 2 5") or a 4-letter word (e.g. "HILL").')
        v = [int(p) % 26 for p in parts]
    return [[v[0], v[1]], [v[2], v[3]]]


def inverse_key(K):
    """K^-1 = det^-1 * adj(K) mod 26, or raise if det is not invertible mod 26."""
    det = (K[0][0] * K[1][1] - K[0][1] * K[1][0]) % 26
    if gcd(det, 26) != 1:
        raise ValueError(f"This key cannot be inverted: its determinant is {det}, which shares a factor with 26 (gcd = {gcd(det, 26)}). Choose a key whose determinant is odd and not 13.")
    d_inv = pow(det, -1, 26)
    adj = [[K[1][1], -K[0][1]], [-K[1][0], K[0][0]]]
    return [[(x * d_inv) % 26 for x in row] for row in adj]


def mul(M, p):
    """Matrix x column vector mod 26."""
    return [(M[0][0] * p[0] + M[0][1] * p[1]) % 26, (M[1][0] * p[0] + M[1][1] * p[1]) % 26]


def hill(text: str, key: str, decrypting: bool) -> str:
    K = parse_key(key)
    inv = inverse_key(K)
    s = only_letters(text)
    if not s:
        raise ValueError("Enter a message containing letters.")
    if len(s) % 2:
        if decrypting:
            raise ValueError("Hill ciphertext must have an even number of letters.")
        s += "X"
    M = inv if decrypting else K
    out = []
    for i in range(0, len(s), 2):
        c = mul(M, [ord(s[i]) - 65, ord(s[i + 1]) - 65])
        out.append(chr(c[0] + 65) + chr(c[1] + 65))
    return "".join(out)


def main(argv):
    mode, text, key = SAMPLE
    if len(argv) >= 1: mode = argv[0]
    if len(argv) >= 2: text = argv[1]
    if len(argv) >= 3: key = argv[2]
    if not text:
        sys.exit("Error: Enter a message")
    try:
        print(hill(text, key, mode == "decrypt"))
    except ValueError as e:
        sys.exit(f"Error: {e}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main(sys.argv[1:])
