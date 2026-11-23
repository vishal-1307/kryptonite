#!/usr/bin/env python3
"""
Kryptonite - SHA-256, LIBRARY ROUTE (Python's built-in hashlib).

EDUCATIONAL EXAMPLE accompanying Kryptonite's step-by-step SHA-256.

This is the optional alternative to sha256.py: the same digest from the standard
library's vetted, fast implementation. This is what real programs should use.
(For passwords use Argon2/bcrypt/scrypt; for keyed integrity use hmac + sha256.)

Usage:  python3 sha256_lib.py [text]     (default "abc")
"""
import hashlib  # library route
import sys

if __name__ == "__main__":
    text = sys.argv[1] if len(sys.argv) > 1 else "abc"
    print(hashlib.sha256(text.encode("utf-8")).hexdigest())
