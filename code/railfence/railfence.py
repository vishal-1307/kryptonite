#!/usr/bin/env python3
"""
Kryptonite - Rail Fence cipher (Python 3, standard library only).

Usage:
    python3 railfence.py                                  # sample: WEAREDISCOVEREDFLEEATONCE, 3 rails
    python3 railfence.py encrypt "Hello world" 4
    python3 railfence.py decrypt "WECRLTEERDSOEEFEAOCAIVDEN" 3

Every character (including spaces and Unicode) is kept; only the order changes.
"""
import sys

SAMPLE = ("encrypt", "WEAREDISCOVEREDFLEEATONCE", 3)


def zigzag(length: int, rails: int):
    """Rail index (row) of each position when writing down and up across `rails` rows."""
    rows, r, d = [], 0, 1
    for _ in range(length):
        rows.append(r)
        if r == 0:
            d = 1
        elif r == rails - 1:
            d = -1
        r += d
    return rows


def check_rails(rails) -> int:
    n = int(rails)
    if n < 2:
        raise ValueError("Rails must be a whole number of at least 2.")
    return n


def encrypt(text: str, rails: int) -> str:
    """Write in a zigzag, then read rail by rail."""
    n = check_rails(rails)
    chars = list(text)  # Python str iterates code points, like Kryptonite's [...text]
    rows = zigzag(len(chars), n)
    return "".join(ch for r in range(n) for ch, row in zip(chars, rows) if row == r)


def decrypt(text: str, rails: int) -> str:
    """Mark the zigzag, fill each rail with the next ciphertext characters, read the zigzag."""
    n = check_rails(rails)
    chars = list(text)
    rows = zigzag(len(chars), n)
    res, k = [None] * len(chars), 0
    for r in range(n):
        for i, row in enumerate(rows):
            if row == r:
                res[i] = chars[k]
                k += 1
    return "".join(res)


def main(argv):
    mode, text, rails = SAMPLE
    if len(argv) >= 1: mode = argv[0]
    if len(argv) >= 2: text = argv[1]
    if len(argv) >= 3: rails = argv[2]
    if not text:
        sys.exit("Error: Enter a message")
    try:
        print(encrypt(text, rails) if mode == "encrypt" else decrypt(text, rails))
    except ValueError as e:
        sys.exit(f"Error: {e}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main(sys.argv[1:])
