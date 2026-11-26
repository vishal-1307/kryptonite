// Kryptonite - Diffie-Hellman key exchange (C++17, standard library only).
//
// Build & run:
//   g++ -std=c++17 -O2 diffiehellman.cpp -o diffiehellman && ./diffiehellman
//   ./diffiehellman 467 2 153 197
// Output: the shared secret. Degenerate parameters are rejected, as in Kryptonite.
#include <cstdint>
#include <iostream>
#include <string>
#include <vector>

using u64 = unsigned long long;

// p <= 1e9, so a*b < 1e18 fits in 64 bits.
u64 modPow(u64 b, u64 e, u64 m) {
    u64 r = 1 % m;
    b %= m;
    while (e) { if (e & 1) r = r * b % m; b = b * b % m; e >>= 1; }
    return r;
}

bool isPrime(u64 n) {
    if (n < 2) return false;
    if (n % 2 == 0) return n == 2;
    for (u64 i = 3; i * i <= n; i += 2) if (n % i == 0) return false;
    return true;
}

std::vector<u64> primeFactors(u64 n) {
    std::vector<u64> out;
    for (u64 f = 2; f * f <= n; f += (f == 2 ? 1 : 2))
        if (n % f == 0) { out.push_back(f); while (n % f == 0) n /= f; }
    if (n > 1) out.push_back(n);
    return out;
}

// Multiplicative order of g mod prime p (the size of the subgroup g generates).
u64 orderOf(u64 g, u64 p) {
    u64 order = p - 1;
    for (u64 q : primeFactors(p - 1))
        while (order % q == 0 && modPow(g, order / q, p) == 1) order /= q;
    return order;
}

// Same checks as Kryptonite's validate(); empty string = OK.
std::string check(long long p, long long g, long long a, long long b) {
    long long v[4] = {p, g, a, b};
    const char* names[4] = {"p", "g", "a", "b"};
    for (int i = 0; i < 4; i++)
        if (v[i] < 1 || v[i] > 1000000000LL) return std::string(names[i]) + " must be a whole number between 1 and 1,000,000,000.";
    if (!isPrime(u64(p))) return "p = " + std::to_string(p) + " is not prime.";
    if (g < 2 || g >= p) return "g must be between 2 and p - 1.";
    u64 ord = orderOf(u64(g), u64(p));
    if (ord <= 2) return "g = " + std::to_string(g) + " is a trivial generator: its powers mod " + std::to_string(p) + " only take " + std::to_string(ord) + " value(s).";
    if (a < 2 || b < 2 || a > p - 2 || b > p - 2) return "Secrets a and b must be between 2 and p - 2 (" + std::to_string(p - 2) + ").";
    u64 A = modPow(g, a, p), B = modPow(g, b, p), secret = modPow(B, a, p);
    // RFC 7919 §5.1 / NIST SP 800-56A: a received public value y must satisfy 1 < y < p-1.
    if (A == 1) return "Degenerate parameters: A = g^a mod p = 1.";
    if (B == 1) return "Degenerate parameters: B = g^b mod p = 1.";
    if (A == u64(p) - 1) return "Degenerate parameters: A = g^a mod p = p − 1. A public value of p − 1 makes the shared secret 1 or p − 1, so Eve can guess it (RFC 7919: 1 < y < p − 1).";
    if (B == u64(p) - 1) return "Degenerate parameters: B = g^b mod p = p − 1. A public value of p − 1 makes the shared secret 1 or p − 1, so Eve can guess it (RFC 7919: 1 < y < p − 1).";
    if (secret == 1) return "Degenerate parameters: the shared secret is 1.";
    if (secret == u64(p) - 1) return "Degenerate parameters: the shared secret is p − 1. Implementations must reject values of 1 and p − 1 (RFC 7919).";
    return "";
}

int main(int argc, char** argv) {
    long long v[4] = {23, 5, 4, 3};
    for (int i = 1; i < argc && i <= 4; i++) v[i - 1] = std::stoll(argv[i]);
    long long p = v[0], g = v[1], a = v[2], b = v[3];
    std::string err = check(p, g, a, b);
    if (!err.empty()) { std::cerr << "Error: " << err << "\n"; return 1; }
    u64 A = modPow(g, a, p), B = modPow(g, b, p);      // public values, sent in the clear
    u64 sAlice = modPow(B, a, p), sBob = modPow(A, b, p); // both equal g^(ab) mod p
    if (sAlice != sBob) { std::cerr << "Error: mismatch\n"; return 1; }
    std::cout << sAlice << "\n";
    return 0;
}
