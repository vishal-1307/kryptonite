#!/usr/bin/env python3
"""
Kryptonite - Caesar cipher (Python 3, standard library only).

EDUCATIONAL CODE ONLY. The Caesar cipher has 25 useful keys and is broken by
trying them all. Never use this to protect real data; use a vetted library
(e.g. libsodium, or AES-GCM from `cryptography`) instead.

Usage:
    python3 caesar.py                         # sample: encrypt "Attack at dawn" with shift 3
    python3 caesar.py encrypt "Hello" 7
    python3 caesar.py decrypt "Olssv" 7

Output: the result text on one line (same as Kryptonite's output box).
Only A-Z / a-z are shifted (case kept); everything else is copied unchanged.
"""
import sys

SAMPLE = ("encrypt", "Attack at dawn", 3)


def shift_char(ch: str, k: int) -> str:
    """Shift one ASCII letter by k places (wrapping Z->A); leave anything else unchanged."""
    if "A" <= ch <= "Z":
        return chr((ord(ch) - 65 + k) % 26 + 65)
    if "a" <= ch <= "z":
        return chr((ord(ch) - 97 + k) % 26 + 97)
    return ch


def shift_text(text: str, k: int) -> str:
    """Apply shift_char to every character."""
    return "".join(shift_char(c, k) for c in text)


def encrypt(text: str, shift: int) -> str:
    """E(x) = (x + k) mod 26."""
    return shift_text(text, shift % 26)


def decrypt(text: str, shift: int) -> str:
    """D(x) = (x - k) mod 26."""
    return shift_text(text, -(shift % 26))


def main(argv):
    mode, text, shift = SAMPLE
    if len(argv) >= 1: mode = argv[0]
    if len(argv) >= 2: text = argv[1]
    if len(argv) >= 3: shift = int(argv[2])
    if not text:
        sys.exit("Error: Enter a message")
    if mode not in ("encrypt", "decrypt"):
        sys.exit("Error: mode must be encrypt or decrypt")
    print(encrypt(text, shift) if mode == "encrypt" else decrypt(text, shift))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main(sys.argv[1:])
