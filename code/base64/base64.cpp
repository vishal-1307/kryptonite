// Kryptonite - Base64 encode/decode implemented by hand (C++17, standard library only).
//
// Build & run:
//   g++ -std=c++17 -O2 base64.cpp -o base64 && ./base64
//   ./base64 encode "Hello"
//   ./base64 decode "SGVsbG8="      (also accepts base64url and missing padding)
// Decoding prints the decoded text (byte-exact, a UTF-8 BOM is kept) or, if the
// bytes are not valid UTF-8, their hex.
#include <cstdint>
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>

const std::string CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// Every 3 bytes -> four 6-bit groups -> four characters; '=' marks missing bytes.
std::string encode(const std::string& data) {
    std::string out;
    for (size_t i = 0; i < data.size(); i += 3) {
        size_t take = data.size() - i;
        uint32_t n = uint32_t((unsigned char)data[i]) << 16;
        if (take > 1) n |= uint32_t((unsigned char)data[i + 1]) << 8;
        if (take > 2) n |= uint32_t((unsigned char)data[i + 2]);
        out += CHARS[(n >> 18) & 63];
        out += CHARS[(n >> 12) & 63];
        out += take > 1 ? CHARS[(n >> 6) & 63] : '=';
        out += take > 2 ? CHARS[n & 63] : '=';
    }
    return out;
}

// Remove whitespace, map base64url to standard, add missing padding, validate.
std::string normalize(const std::string& in) {
    std::string s;
    bool urlSafe = false, std64 = false;
    for (char c : in) {
        if (c == ' ' || c == '\t' || c == '\n' || c == '\r' || c == '\f' || c == '\v') continue;
        if (c == '-' || c == '_') urlSafe = true;
        if (c == '+' || c == '/') std64 = true;
        s += c == '-' ? '+' : c == '_' ? '/' : c;
    }
    if (urlSafe && std64) throw std::runtime_error("Mixes standard (+ /) and URL-safe (- _) Base64 characters.");
    size_t eq = s.find('=');
    std::string body = eq == std::string::npos ? s : s.substr(0, eq);
    std::string tail = eq == std::string::npos ? "" : s.substr(eq);
    bool ok = tail.size() <= 2;
    for (char c : tail) if (c != '=') ok = false;
    for (char c : body) if (CHARS.find(c) == std::string::npos) ok = false;
    if (!ok) throw std::runtime_error("Not valid Base64: use A-Z, a-z, 0-9, + and / (or - and _), with \"=\" only at the end.");
    if (tail.empty() && s.size() % 4) {
        if (s.size() % 4 == 1) throw std::runtime_error("Not valid Base64: the length cannot be one more than a multiple of 4.");
        s += std::string(4 - s.size() % 4, '=');
    }
    if (s.size() % 4) throw std::runtime_error("Not valid Base64: the length (with \"=\" padding) must be a multiple of 4.");
    return s;
}

// Characters -> 6-bit sextets -> 8-bit bytes (rejects non-canonical padding bits).
std::vector<uint8_t> decode(const std::string& text) {
    std::string s = normalize(text);
    std::vector<uint8_t> out;
    for (size_t i = 0; i < s.size(); i += 4) {
        uint32_t n = 0;
        for (int k = 0; k < 4; k++) n = (n << 6) | (s[i + k] == '=' ? 0 : uint32_t(CHARS.find(s[i + k])));
        if ((s[i + 2] == '=' && (n & 0xFFFF)) || (s[i + 3] == '=' && (n & 0xFF)))
            throw std::runtime_error("\"" + s.substr(i, 4) + "\" is non-canonical Base64: the unused bits before \"=\" must be zero.");
        out.push_back(uint8_t(n >> 16));
        if (s[i + 2] != '=') out.push_back(uint8_t(n >> 8));
        if (s[i + 3] != '=') out.push_back(uint8_t(n));
    }
    return out;
}

// Strict UTF-8 validation (rejects overlongs, surrogates, > U+10FFFF).
bool validUtf8(const std::vector<uint8_t>& s) {
    size_t i = 0;
    while (i < s.size()) {
        uint8_t c = s[i];
        if (c < 0x80) { i++; continue; }
        int n; uint32_t cp, min;
        if ((c & 0xE0) == 0xC0) { n = 1; cp = c & 0x1F; min = 0x80; }
        else if ((c & 0xF0) == 0xE0) { n = 2; cp = c & 0x0F; min = 0x800; }
        else if ((c & 0xF8) == 0xF0) { n = 3; cp = c & 0x07; min = 0x10000; }
        else return false;
        for (int k = 1; k <= n; k++) {
            if (i + k >= s.size() || (s[i + k] & 0xC0) != 0x80) return false;
            cp = (cp << 6) | (s[i + k] & 0x3F);
        }
        if (cp < min || cp > 0x10FFFF || (cp >= 0xD800 && cp <= 0xDFFF)) return false;
        i += n + 1;
    }
    return true;
}

int main(int argc, char** argv) {
    std::string mode = argc > 1 ? argv[1] : "encode";
    std::string text = argc > 2 ? argv[2] : "Man";
    try {
        if (mode == "encode") { std::cout << encode(text) << "\n"; return 0; }
        auto bytes = decode(text);
        if (validUtf8(bytes)) std::cout << std::string(bytes.begin(), bytes.end()) << "\n";
        else {
            static const char* d = "0123456789abcdef";
            std::string hex;
            for (auto b : bytes) { hex += d[b >> 4]; hex += d[b & 15]; }
            std::cout << hex << "\n";
        }
    } catch (const std::exception& e) { std::cerr << "Error: " << e.what() << "\n"; return 1; }
    return 0;
}
