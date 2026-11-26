#!/usr/bin/env python3
"""
Kryptonite - textbook RSA (Python 3, standard library only).

Usage:
    python3 rsa.py                                    # sample: p=61 q=53 e=17, encrypt "HI"
    python3 rsa.py encrypt 61 53 17 text "Hello"
    python3 rsa.py encrypt 61 53 17 numbers "65"
    python3 rsa.py decrypt 61 53 17 text "3000 28"

Output (same as Kryptonite): ciphertext numbers separated by spaces; when
decrypting with format "text", the characters (numbers are Unicode code points).
"""
import re
import sys

SAMPLE = ("encrypt", 61, 53, 17, "text", "HI")


def is_prime(n: int) -> bool:
    """Trial division (fine for the demo sizes)."""
    if n < 2:
        return False
    if n % 2 == 0:
        return n == 2
    i = 3
    while i * i <= n:
        if n % i == 0:
            return False
        i += 2
    return True


def gcd(a: int, b: int) -> int:
    while b:
        a, b = b, a % b
    return a


def inverse_table(e: int, phi: int):
    """Extended Euclid as taught for RSA: rows (r, t) start (phi, 0), (e, 1); every row keeps r = t*e (mod phi)."""
    rows = [(phi, 0), (e, 1)]
    while rows[-1][0] > 1:
        (r0, t0), (r1, t1) = rows[-2], rows[-1]
        q = r0 // r1
        rows.append((r0 - q * r1, t0 - q * t1))
        if rows[-1][0] == 0:
            break
    r, t = rows[-1]
    return (t % phi) if r == 1 else None


def mod_pow(base: int, exp: int, m: int) -> int:
    """Left-to-right square-and-multiply (same order as Kryptonite's step table)."""
    acc = 1
    base %= m
    for bit in bin(exp)[2:]:
        acc = acc * acc % m
        if bit == "1":
            acc = acc * base % m
    return acc


def rsa_keys(p: int, q: int, e: int):
    """n = p*q, phi = (p-1)(q-1), d = e^-1 mod phi, with the same checks as Kryptonite."""
    if not is_prime(p): raise ValueError(f"p = {p} is not prime.")
    if not is_prime(q): raise ValueError(f"q = {q} is not prime.")
    if p == q: raise ValueError("p and q must be different primes.")
    n, phi = p * q, (p - 1) * (q - 1)
    if e <= 1 or e >= phi: raise ValueError(f"e must satisfy 1 < e < phi(n) = {phi}.")
    if gcd(e, phi) != 1: raise ValueError(f"e = {e} shares a factor with phi(n) = {phi} (gcd = {gcd(e, phi)}).")
    return n, phi, inverse_table(e, phi)


def parse_numbers(s: str):
    parts = [x for x in re.split(r"[\s,;]+", s.strip()) if x]
    if not parts:
        raise ValueError("Enter at least one number.")
    for x in parts:
        if not re.fullmatch(r"\d+", x):
            raise ValueError(f'"{x}" is not a whole number.')
    return [int(x) for x in parts]


def run(mode, p, q, e, fmt, message) -> str:
    if not message:
        raise ValueError("Enter a message")
    n, phi, d = rsa_keys(p, q, e)
    if mode == "decrypt" or fmt == "numbers":
        blocks = parse_numbers(message)
    else:
        blocks = [ord(c) for c in message]  # each character -> its Unicode code point
    for m in blocks:
        if m >= n:
            raise ValueError(f"{m} is not smaller than n = {n}. Each block must be less than n.")
    exp = d if mode == "decrypt" else e
    results = [mod_pow(x, exp, n) for x in blocks]
    if mode == "decrypt" and fmt != "numbers" and all(r <= 0x10FFFF for r in results):
        return "".join(chr(r) for r in results)
    return " ".join(str(r) for r in results)


def main(argv):
    a = list(SAMPLE)
    for i, v in enumerate(argv[:6]):
        a[i] = int(v) if i in (1, 2, 3) else v
    try:
        print(run(*a))
    except ValueError as err:
        sys.exit(f"Error: {err}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main(sys.argv[1:])
