#!/usr/bin/env python3
"""
Kryptonite - SHA-256, LIBRARY ROUTE (Python's built-in hashlib).

Usage:  python3 sha256_lib.py [text]     (default "abc")
"""
import hashlib  # library route
import sys

if __name__ == "__main__":
    text = sys.argv[1] if len(sys.argv) > 1 else "abc"
    print(hashlib.sha256(text.encode("utf-8")).hexdigest())
