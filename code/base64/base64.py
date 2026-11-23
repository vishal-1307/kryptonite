#!/usr/bin/env python3
"""
Kryptonite - Base64 encode/decode implemented by hand (Python 3, standard library only).

Base64 is an ENCODING, not encryption: there is no key and anyone can decode it.
Never use it to hide secrets. In real programs use the standard `base64` module.

Usage:
    python3 base64.py                       # sample: encode "Man" -> TWFu
    python3 base64.py encode "Hello"
    python3 base64.py decode "SGVsbG8="     # also accepts base64url (- _) and missing padding

Output (same as Kryptonite): encoding prints the Base64 text; decoding prints the
decoded text (byte-exact: a UTF-8 BOM is kept) or, if the bytes are not valid
UTF-8, their hex.
(Note: this file is named base64.py like the stdlib module; it does not import it.)
"""
import re
import sys

CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"


def encode(data: bytes) -> str:
    """Every 3 bytes (24 bits) -> four 6-bit groups -> four characters; '=' marks missing bytes."""
    out = []
    for i in range(0, len(data), 3):
        chunk = data[i:i + 3]
        n = int.from_bytes(chunk + b"\x00" * (3 - len(chunk)), "big")
        out.append(CHARS[(n >> 18) & 63] + CHARS[(n >> 12) & 63])
        out.append(CHARS[(n >> 6) & 63] if len(chunk) > 1 else "=")
        out.append(CHARS[n & 63] if len(chunk) > 2 else "=")
    return "".join(out)


def normalize(s: str) -> str:
    """Remove whitespace, map base64url (- _) to (+ /), add missing '=' padding, validate."""
    s = re.sub(r"\s+", "", s)
    url_safe = bool(re.search(r"[-_]", s))
    if url_safe and re.search(r"[+/]", s):
        raise ValueError("Mixes standard (+ /) and URL-safe (- _) Base64 characters.")
    s = s.replace("-", "+").replace("_", "/")
    if not re.fullmatch(r"[A-Za-z0-9+/]*={0,2}", s):
        raise ValueError('Not valid Base64: use A-Z, a-z, 0-9, + and / (or - and _), with "=" only at the end.')
    if "=" not in s and len(s) % 4:
        if len(s) % 4 == 1:
            raise ValueError("Not valid Base64: the length cannot be one more than a multiple of 4.")
        s += "=" * (4 - len(s) % 4)
    if len(s) % 4:
        raise ValueError('Not valid Base64: the length (with "=" padding) must be a multiple of 4.')
    return s


def decode(text: str) -> bytes:
    """Characters -> 6-bit sextets -> 8-bit bytes (rejects non-canonical padding bits, RFC 4648 3.5)."""
    s = normalize(text)
    out = bytearray()
    for i in range(0, len(s), 4):
        q = s[i:i + 4]
        n = 0
        for ch in q:
            n = (n << 6) | (0 if ch == "=" else CHARS.index(ch))
        if (q[2] == "=" and n & 0xFFFF) or (q[3] == "=" and n & 0xFF):
            raise ValueError(f'"{q}" is non-canonical Base64: the unused bits before "=" must be zero.')
        out.append((n >> 16) & 255)
        if q[2] != "=":
            out.append((n >> 8) & 255)
        if q[3] != "=":
            out.append(n & 255)
    return bytes(out)


def decode_to_display(text: str) -> str:
    """Decoded text if valid UTF-8 (keeping any BOM), otherwise the bytes in hex."""
    data = decode(text)
    try:
        return data.decode("utf-8")  # strict; 'utf-8' (not 'utf-8-sig') keeps a BOM as U+FEFF
    except UnicodeDecodeError:
        return data.hex()


def main(argv):
    mode = argv[0] if len(argv) > 0 else "encode"
    text = argv[1] if len(argv) > 1 else "Man"
    try:
        print(encode(text.encode("utf-8")) if mode == "encode" else decode_to_display(text))
    except ValueError as e:
        sys.exit(f"Error: {e}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main(sys.argv[1:])
