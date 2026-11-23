// Kryptonite - Hill cipher, 2x2 (C++17, standard library only).
//
// EDUCATIONAL CODE ONLY. Hill is linear and falls to a known-plaintext attack.
// Never use it to protect real data; use a vetted library instead.
//
// Build & run:
//   g++ -std=c++17 -O2 hill.cpp -o hill && ./hill
//   ./hill encrypt "short example" HILL
//   ./hill decrypt HIAT "3 3 2 5"
// Key: 4 whole numbers (any length: each is reduced mod 26 digit by digit, so huge
// values are exact) or a 4-letter word. det(K) must be coprime with 26.
#include <array>
#include <cctype>
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>

using Mat = std::array<std::array<int, 2>, 2>;

std::string onlyLetters(const std::string& s) {
    std::string r;
    for (char c : s) { c = char(std::toupper((unsigned char)c)); if (c >= 'A' && c <= 'Z') r += c; }
    return r;
}

// Reduce a decimal integer string (optional sign) mod 26 without overflow.
int decimalMod26(const std::string& t) {
    size_t i = 0;
    bool neg = false;
    if (t[0] == '+' || t[0] == '-') { neg = t[0] == '-'; i = 1; }
    if (i >= t.size()) throw std::runtime_error("bad number");
    int r = 0;
    for (; i < t.size(); i++) {
        if (!std::isdigit((unsigned char)t[i])) throw std::runtime_error("bad number");
        r = (r * 10 + (t[i] - '0')) % 26;
    }
    return neg ? (26 - r) % 26 : r;
}

// Parse "a b c d" (separated by spaces, commas or semicolons) or a 4-letter word.
Mat parseKey(const std::string& key) {
    std::string noSpace;
    for (char c : key) if (!std::isspace((unsigned char)c)) noSpace += c;
    std::vector<int> v;
    bool word = noSpace.size() == 4;
    for (char c : noSpace) if (!std::isalpha((unsigned char)c)) word = false;
    if (word) { for (char c : onlyLetters(noSpace)) v.push_back(c - 'A'); }
    else {
        std::vector<std::string> parts;
        std::string cur;
        for (char c : key) {
            if (std::isspace((unsigned char)c) || c == ',' || c == ';') { if (!cur.empty()) parts.push_back(cur); cur.clear(); }
            else cur += c;
        }
        if (!cur.empty()) parts.push_back(cur);
        const char* msg = "Key must be 4 whole numbers (e.g. \"3 3 2 5\") or a 4-letter word (e.g. \"HILL\").";
        if (parts.size() != 4) throw std::runtime_error(msg);
        try { for (auto& p : parts) v.push_back(decimalMod26(p)); } catch (...) { throw std::runtime_error(msg); }
    }
    return Mat{{{v[0], v[1]}, {v[2], v[3]}}};
}

int gcd(int a, int b) { while (b) { int t = a % b; a = b; b = t; } return a; }

// K^-1 = det^-1 * adj(K) mod 26.
Mat inverseKey(const Mat& K) {
    int det = ((K[0][0] * K[1][1] - K[0][1] * K[1][0]) % 26 + 26) % 26;
    if (gcd(det, 26) != 1)
        throw std::runtime_error("This key cannot be inverted: its determinant is " + std::to_string(det) +
            ", which shares a factor with 26 (gcd = " + std::to_string(gcd(det, 26)) + "). Choose a key whose determinant is odd and not 13.");
    int dInv = 1;
    while ((det * dInv) % 26 != 1) dInv++;
    Mat adj{{{K[1][1], -K[0][1]}, {-K[1][0], K[0][0]}}};
    Mat inv;
    for (int r = 0; r < 2; r++) for (int c = 0; c < 2; c++) inv[r][c] = ((adj[r][c] * dInv) % 26 + 26) % 26;
    return inv;
}

// Matrix x column vector mod 26. Entries are 0..25, so products stay tiny.
std::array<int, 2> mul(const Mat& M, std::array<int, 2> p) {
    return {(M[0][0] * p[0] + M[0][1] * p[1]) % 26, (M[1][0] * p[0] + M[1][1] * p[1]) % 26};
}

std::string hill(const std::string& text, const std::string& key, bool decrypting) {
    Mat K = parseKey(key);
    Mat inv = inverseKey(K);
    std::string s = onlyLetters(text);
    if (s.empty()) throw std::runtime_error("Enter a message containing letters.");
    if (s.size() % 2) {
        if (decrypting) throw std::runtime_error("Hill ciphertext must have an even number of letters.");
        s += 'X';
    }
    const Mat& M = decrypting ? inv : K;
    std::string out;
    for (size_t i = 0; i < s.size(); i += 2) {
        auto c = mul(M, {s[i] - 'A', s[i + 1] - 'A'});
        out += char('A' + c[0]); out += char('A' + c[1]);
    }
    return out;
}

int main(int argc, char** argv) {
    std::string mode = "encrypt", text = "HELP", key = "3 3 2 5";
    if (argc > 1) mode = argv[1];
    if (argc > 2) text = argv[2];
    if (argc > 3) key = argv[3];
    if (text.empty()) { std::cerr << "Error: Enter a message\n"; return 1; }
    try { std::cout << hill(text, key, mode == "decrypt") << "\n"; }
    catch (const std::exception& e) { std::cerr << "Error: " << e.what() << "\n"; return 1; }
    return 0;
}
