// Kryptonite - textbook RSA (C++17, standard library only).
//
// EDUCATIONAL CODE ONLY - NOT FOR PRODUCTION. "Textbook" RSA with tiny demonstration
// primes, no padding and one character per block: deterministic, malleable and easy
// to factor. Real RSA uses 2048+ bit keys, OAEP padding for encryption and PSS for
// signatures. For real data use a vetted library (OpenSSL EVP_PKEY with
// RSA_PKCS1_OAEP_PADDING, or Python's cryptography package).
//
// Build & run:
//   g++ -std=c++17 -O2 rsa.cpp -o rsa && ./rsa
//   ./rsa encrypt 61 53 17 text "Hello"
//   ./rsa encrypt 61 53 17 numbers "65"
//   ./rsa decrypt 61 53 17 text "3000 28"
// Numbers are unsigned 64-bit; mulmod() uses add-and-double so products never overflow
// (n must stay below 2^63, far above the demo's limit of p, q <= 10,000,000).
#include <cstdint>
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>

using u64 = unsigned long long;
using i64 = long long;

// (a * b) mod m without overflow, by binary add-and-double.
u64 mulmod(u64 a, u64 b, u64 m) {
    u64 r = 0;
    a %= m;
    while (b) {
        if (b & 1) { r += a; if (r >= m) r -= m; }
        a <<= 1; if (a >= m) a -= m;
        b >>= 1;
    }
    return r;
}

// Left-to-right square-and-multiply, the same order as Kryptonite's step table.
u64 modPow(u64 base, u64 exp, u64 m) {
    u64 acc = 1 % m;
    base %= m;
    int top = 63;
    while (top > 0 && !((exp >> top) & 1)) top--;
    for (int i = top; i >= 0; i--) {
        acc = mulmod(acc, acc, m);
        if ((exp >> i) & 1) acc = mulmod(acc, base, m);
    }
    return acc;
}

bool isPrime(u64 n) {
    if (n < 2) return false;
    if (n % 2 == 0) return n == 2;
    for (u64 i = 3; i * i <= n; i += 2) if (n % i == 0) return false;
    return true;
}

u64 gcd(u64 a, u64 b) { while (b) { u64 t = a % b; a = b; b = t; } return a; }

// Extended Euclid as taught for RSA: rows (r, t) start (phi, 0), (e, 1); r = t*e (mod phi).
u64 inverseOf(u64 e, u64 phi) {
    i64 r0 = i64(phi), t0 = 0, r1 = i64(e), t1 = 1;
    while (r1 > 1) {
        i64 q = r0 / r1;
        i64 r2 = r0 - q * r1, t2 = t0 - q * t1;
        r0 = r1; t0 = t1; r1 = r2; t1 = t2;
        if (r1 == 0) break;
    }
    if (r1 != 1) throw std::runtime_error("e has no inverse");
    i64 d = t1 % i64(phi);
    if (d < 0) d += i64(phi);
    return u64(d);
}

// Decode UTF-8 into Unicode code points (each character becomes one block m).
std::vector<u64> codePoints(const std::string& s) {
    std::vector<u64> out;
    for (size_t i = 0; i < s.size();) {
        unsigned char c = (unsigned char)s[i];
        int n = c < 0x80 ? 0 : (c >> 5) == 6 ? 1 : (c >> 4) == 14 ? 2 : 3;
        u64 cp = n == 0 ? c : n == 1 ? (c & 0x1F) : n == 2 ? (c & 0x0F) : (c & 0x07);
        for (int k = 1; k <= n && i + k < s.size(); k++) cp = (cp << 6) | ((unsigned char)s[i + k] & 0x3F);
        out.push_back(cp);
        i += n + 1;
    }
    return out;
}

std::string utf8(u64 cp) {
    std::string s;
    if (cp < 0x80) s += char(cp);
    else if (cp < 0x800) { s += char(0xC0 | (cp >> 6)); s += char(0x80 | (cp & 0x3F)); }
    else if (cp < 0x10000) { s += char(0xE0 | (cp >> 12)); s += char(0x80 | ((cp >> 6) & 0x3F)); s += char(0x80 | (cp & 0x3F)); }
    else { s += char(0xF0 | (cp >> 18)); s += char(0x80 | ((cp >> 12) & 0x3F)); s += char(0x80 | ((cp >> 6) & 0x3F)); s += char(0x80 | (cp & 0x3F)); }
    return s;
}

std::vector<u64> parseNumbers(const std::string& s) {
    std::vector<u64> out;
    std::string cur;
    auto flush = [&]() {
        if (cur.empty()) return;
        for (char c : cur) if (c < '0' || c > '9') throw std::runtime_error("\"" + cur + "\" is not a whole number.");
        out.push_back(std::stoull(cur));
        cur.clear();
    };
    for (char c : s) { if (c == ' ' || c == '\t' || c == '\n' || c == ',' || c == ';') flush(); else cur += c; }
    flush();
    if (out.empty()) throw std::runtime_error("Enter at least one number.");
    return out;
}

int main(int argc, char** argv) {
    std::string mode = "encrypt", fmt = "text", message = "HI";
    u64 p = 61, q = 53, e = 17;
    if (argc > 1) mode = argv[1];
    if (argc > 2) p = std::stoull(argv[2]);
    if (argc > 3) q = std::stoull(argv[3]);
    if (argc > 4) e = std::stoull(argv[4]);
    if (argc > 5) fmt = argv[5];
    if (argc > 6) message = argv[6];
    try {
        if (message.empty()) throw std::runtime_error("Enter a message");
        if (!isPrime(p)) throw std::runtime_error("p = " + std::to_string(p) + " is not prime.");
        if (!isPrime(q)) throw std::runtime_error("q = " + std::to_string(q) + " is not prime.");
        if (p == q) throw std::runtime_error("p and q must be different primes.");
        u64 n = p * q, phi = (p - 1) * (q - 1);
        if (e <= 1 || e >= phi) throw std::runtime_error("e must satisfy 1 < e < phi(n) = " + std::to_string(phi) + ".");
        if (gcd(e, phi) != 1) throw std::runtime_error("e = " + std::to_string(e) + " shares a factor with phi(n) = " + std::to_string(phi) + ".");
        u64 d = inverseOf(e, phi);
        std::vector<u64> blocks = (mode == "decrypt" || fmt == "numbers") ? parseNumbers(message) : codePoints(message);
        for (u64 m : blocks) if (m >= n) throw std::runtime_error(std::to_string(m) + " is not smaller than n = " + std::to_string(n) + ". Each block must be less than n.");
        std::vector<u64> res;
        for (u64 x : blocks) res.push_back(modPow(x, mode == "decrypt" ? d : e, n));
        bool asText = mode == "decrypt" && fmt != "numbers";
        for (u64 r : res) if (r > 0x10FFFF) asText = false;
        std::string out;
        for (size_t i = 0; i < res.size(); i++) {
            if (asText) out += utf8(res[i]);
            else { if (i) out += ' '; out += std::to_string(res[i]); }
        }
        std::cout << out << "\n";
    } catch (const std::exception& ex) { std::cerr << "Error: " << ex.what() << "\n"; return 1; }
    return 0;
}
