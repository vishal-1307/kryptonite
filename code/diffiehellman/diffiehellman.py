#!/usr/bin/env python3
"""
Kryptonite - Diffie-Hellman key exchange (Python 3, standard library only).

Usage:
    python3 diffiehellman.py                 # sample: p=23 g=5 a=4 b=3 -> 18
    python3 diffiehellman.py 467 2 153 197

Output (same as Kryptonite): the shared secret. Degenerate parameters
(g = 1 or p-1, secrets outside 2..p-2, public value or shared secret = 1,
generator of order <= 2) are rejected with an error, as in Kryptonite.
"""
import sys

SAMPLE = (23, 5, 4, 3)


def is_prime(n: int) -> bool:
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


def prime_factors(n: int):
    out, f = [], 2
    while f * f <= n:
        if n % f == 0:
            out.append(f)
            while n % f == 0:
                n //= f
        f += 1 if f == 2 else 2
    if n > 1:
        out.append(n)
    return out


def order_of(g: int, p: int) -> int:
    """Multiplicative order of g mod prime p: the size of the subgroup g generates."""
    order = p - 1
    for q in prime_factors(p - 1):
        while order % q == 0 and pow(g, order // q, p) == 1:
            order //= q
    return order


def check(p: int, g: int, a: int, b: int):
    """Same checks as Kryptonite's validate(); returns an error message or None."""
    for name, v in (("p", p), ("g", g), ("a", a), ("b", b)):
        if v < 1 or v > 10**9:
            return f"{name} must be a whole number between 1 and 1,000,000,000."
    if not is_prime(p):
        return f"p = {p} is not prime."
    if g < 2 or g >= p:
        return "g must be between 2 and p - 1."
    if order_of(g, p) <= 2:
        return f"g = {g} is a trivial generator: its powers mod {p} only take {order_of(g, p)} value(s)."
    if a < 2 or b < 2 or a > p - 2 or b > p - 2:
        return f"Secrets a and b must be between 2 and p - 2 ({p - 2})."
    A, B = pow(g, a, p), pow(g, b, p)
    s = pow(B, a, p)
    # RFC 7919 §5.1 / NIST SP 800-56A: a received public value y must satisfy 1 < y < p-1.
    if A == 1: return "Degenerate parameters: A = g^a mod p = 1."
    if B == 1: return "Degenerate parameters: B = g^b mod p = 1."
    if A == p - 1: return "Degenerate parameters: A = g^a mod p = p − 1. A public value of p − 1 makes the shared secret 1 or p − 1, so Eve can guess it (RFC 7919: 1 < y < p − 1)."
    if B == p - 1: return "Degenerate parameters: B = g^b mod p = p − 1. A public value of p − 1 makes the shared secret 1 or p − 1, so Eve can guess it (RFC 7919: 1 < y < p − 1)."
    if s == 1: return "Degenerate parameters: the shared secret is 1."
    if s == p - 1: return "Degenerate parameters: the shared secret is p − 1. Implementations must reject values of 1 and p − 1 (RFC 7919)."
    return None


def exchange(p: int, g: int, a: int, b: int):
    """A = g^a, B = g^b (public); s = B^a = A^b = g^(ab) mod p (secret)."""
    A, B = pow(g, a, p), pow(g, b, p)       # sent over the public channel
    s_alice, s_bob = pow(B, a, p), pow(A, b, p)
    assert s_alice == s_bob
    return A, B, s_alice


def main(argv):
    p, g, a, b = (int(x) for x in (list(argv[:4]) + list(SAMPLE)[len(argv[:4]):]))
    err = check(p, g, a, b)
    if err:
        sys.exit(f"Error: {err}")
    print(exchange(p, g, a, b)[2])


if __name__ == "__main__":
    main(sys.argv[1:])
