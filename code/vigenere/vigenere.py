#!/usr/bin/env python3
"""
Kryptonite - Vigenere cipher (Python 3, standard library only).

EDUCATIONAL CODE ONLY. Vigenere is broken by Kasiski examination and frequency
analysis. Never use it to protect real data; use a vetted library instead.

Usage:
    python3 vigenere.py                              # sample: encrypt "ATTACK AT DAWN" with key LEMON
    python3 vigenere.py encrypt "attack at dawn" lemon
    python3 vigenere.py decrypt "LXFOPV EF RNHR" LEMON

Only A-Z / a-z are shifted (case kept). Non-letters are copied unchanged and do
NOT advance the key position. The keyword is reduced to its letters, uppercased.
"""
import sys

SAMPLE = ("encrypt", "ATTACK AT DAWN", "LEMON")


def clean_key(key: str) -> str:
    """Keep only A-Z (uppercased), like Kryptonite's onlyLetters()."""
    return "".join(c for c in key.upper() if "A" <= c <= "Z")


def vigenere(text: str, key: str, decrypting: bool) -> str:
    """Shift each letter by the next key letter (A=0..Z=25); j only advances on letters."""
    k = clean_key(key)
    if not k:
        raise ValueError("The key must contain at least one letter.")
    out, j = [], 0
    for ch in text:
        if ("A" <= ch <= "Z") or ("a" <= ch <= "z"):
            s = ord(k[j % len(k)]) - 65
            j += 1
            base = 65 if ch <= "Z" else 97
            x = ord(ch) - base
            out.append(chr((x - s if decrypting else x + s) % 26 + base))
        else:
            out.append(ch)
    return "".join(out)


def main(argv):
    mode, text, key = SAMPLE
    if len(argv) >= 1: mode = argv[0]
    if len(argv) >= 2: text = argv[1]
    if len(argv) >= 3: key = argv[2]
    if not text:
        sys.exit("Error: Enter a message")
    try:
        print(vigenere(text, key, mode == "decrypt"))
    except ValueError as e:
        sys.exit(f"Error: {e}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main(sys.argv[1:])
