#!/usr/bin/env python3
"""
Kryptonite - Playfair cipher (Python 3, standard library only).

Usage:
    python3 playfair.py                                   # sample from Kryptonite
    python3 playfair.py encrypt "balloon" monarchy
    python3 playfair.py decrypt "IBSUPMNA" monarchy

Rules: only A-Z are used (uppercased), J becomes I, an X (or Q after X) is
inserted between doubled letters and pads an odd final letter. Decryption keeps
the fillers, so it may not give back the exact original text.
"""
import sys

SAMPLE = ("encrypt", "Hide the gold in the tree stump", "playfair example")


def only_letters(s: str) -> str:
    """Keep only A-Z, uppercased."""
    return "".join(c for c in s.upper() if "A" <= c <= "Z")


def key_square(key: str):
    """Build the 5x5 square: key letters first (no repeats, J->I), then the rest of A-Z without J."""
    seen, letters = set(), []
    for ch in (only_letters(key) + "ABCDEFGHIKLMNOPQRSTUVWXYZ").replace("J", "I"):
        if ch not in seen:
            seen.add(ch)
            letters.append(ch)
    grid = [letters[r * 5:r * 5 + 5] for r in range(5)]
    pos = {ch: (r, c) for r, row in enumerate(grid) for c, ch in enumerate(row)}
    return grid, pos


def prepare(text: str):
    """Split plaintext into pairs, inserting fillers. Returns (pairs, fillers[(pair_index, letter, reason)])."""
    s = only_letters(text).replace("J", "I")
    pairs, fillers, i = [], [], 0
    while i < len(s):
        a = s[i]
        b = s[i + 1] if i + 1 < len(s) else None
        filler = "Q" if a == "X" else "X"
        if b is None or a == b:
            fillers.append((len(pairs), filler, "odd" if b is None else "double"))
            pairs.append((a, filler))
            i += 1
        else:
            pairs.append((a, b))
            i += 2
    return pairs, fillers


def transform_pair(a: str, b: str, grid, pos, d: int) -> str:
    """Apply the same-row / same-column / rectangle rule; d = +1 encrypt, -1 decrypt."""
    (r1, c1), (r2, c2) = pos[a], pos[b]
    if r1 == r2:
        return grid[r1][(c1 + d) % 5] + grid[r2][(c2 + d) % 5]
    if c1 == c2:
        return grid[(r1 + d) % 5][c1] + grid[(r2 + d) % 5][c2]
    return grid[r1][c2] + grid[r2][c1]


def encrypt(text: str, key: str) -> str:
    grid, pos = key_square(key)
    pairs, _ = prepare(text)
    if not pairs:
        raise ValueError("Enter a message containing letters.")
    return "".join(transform_pair(a, b, grid, pos, 1) for a, b in pairs)


def decrypt(text: str, key: str) -> str:
    grid, pos = key_square(key)
    s = only_letters(text).replace("J", "I")
    if len(s) % 2:
        raise ValueError("Playfair ciphertext must have an even number of letters.")
    out = []
    for i in range(0, len(s), 2):
        if s[i] == s[i + 1]:
            raise ValueError(f'"{s[i]}{s[i + 1]}" cannot appear in valid Playfair ciphertext (a pair never has two equal letters).')
        out.append(transform_pair(s[i], s[i + 1], grid, pos, -1))
    return "".join(out)


def main(argv):
    mode, text, key = SAMPLE
    if len(argv) >= 1: mode = argv[0]
    if len(argv) >= 2: text = argv[1]
    if len(argv) >= 3: key = argv[2]
    if not text:
        sys.exit("Error: Enter a message")
    try:
        print(encrypt(text, key) if mode == "encrypt" else decrypt(text, key))
    except ValueError as e:
        sys.exit(f"Error: {e}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main(sys.argv[1:])
