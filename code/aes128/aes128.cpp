// Kryptonite - AES-128, one block, implemented by hand (C++17, standard library only).
//
// Function names match the Kryptonite visualizer:
//   KeyExpansion, SubBytes, ShiftRows, MixColumns, AddRoundKey (+ InvSubBytes, InvShiftRows, InvMixColumns)
// State bytes are column-major: index = row + 4*col (FIPS-197).
//
// Build & run:
//   g++ -std=c++17 -O2 aes128.cpp -o aes128 && ./aes128
//   ./aes128 encrypt 00112233445566778899aabbccddeeff 000102030405060708090a0b0c0d0e0f
//   ./aes128 decrypt 69c4e0d86a7b0430d8cdb78070b4c55a 000102030405060708090a0b0c0d0e0f
//   ./aes128 encrypt "Two One Nine Two" "Thats my Kung Fu" --format text --key-format text
//   ./aes128 decrypt <hex> <key> --format text [--padding zero|pkcs7]
#include <array>
#include <cctype>
#include <cstdint>
#include <iostream>
#include <map>
#include <optional>
#include <stdexcept>
#include <string>
#include <vector>

using Block = std::array<uint8_t, 16>;
using Bytes = std::vector<uint8_t>;

// Multiply by x in GF(2^8) modulo x^8 + x^4 + x^3 + x + 1.
uint8_t xtime(uint8_t b) { return uint8_t((b << 1) ^ ((b & 0x80) ? 0x1b : 0)); }

// Multiply two bytes in GF(2^8).
uint8_t gmul(uint8_t a, uint8_t b) {
    uint8_t p = 0;
    while (b) { if (b & 1) p ^= a; a = xtime(a); b >>= 1; }
    return p;
}

std::array<uint8_t, 256> SBOX, INV_SBOX;

// Build the S-box from its definition: inverse in GF(2^8) followed by the affine transform.
void buildSbox() {
    for (int x = 0; x < 256; x++) {
        uint8_t inv = 0;
        if (x) for (int y = 1; y < 256; y++) if (gmul(uint8_t(x), uint8_t(y)) == 1) { inv = uint8_t(y); break; }
        uint8_t s = inv;
        for (int i = 1; i <= 4; i++) s ^= uint8_t((inv << i) | (inv >> (8 - i)));
        s ^= 0x63;
        SBOX[x] = s; INV_SBOX[s] = uint8_t(x);
    }
}

const uint8_t RCON[11] = {0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36};
const uint8_t MIX[4][4] = {{2, 3, 1, 1}, {1, 2, 3, 1}, {1, 1, 2, 3}, {3, 1, 1, 2}};
const uint8_t INV_MIX[4][4] = {{14, 11, 13, 9}, {9, 14, 11, 13}, {13, 9, 14, 11}, {11, 13, 9, 14}};

// Replace every byte using the S-box (non-linear "confusion").
Block SubBytes(Block s) { for (auto& b : s) b = SBOX[b]; return s; }
Block InvSubBytes(Block s) { for (auto& b : s) b = INV_SBOX[b]; return s; }

// Rotate row r left by r.
Block ShiftRows(const Block& s) {
    Block o;
    for (int i = 0; i < 16; i++) { int r = i % 4, c = i / 4; o[i] = s[r + 4 * ((c + r) % 4)]; }
    return o;
}
Block InvShiftRows(const Block& s) {
    Block o;
    for (int i = 0; i < 16; i++) { int r = i % 4, c = i / 4; o[i] = s[r + 4 * ((c - r + 4) % 4)]; }
    return o;
}

Block mixWith(const Block& s, const uint8_t M[4][4]) {
    Block o;
    for (int c = 0; c < 4; c++) for (int r = 0; r < 4; r++) {
        uint8_t v = 0;
        for (int k = 0; k < 4; k++) v ^= gmul(M[r][k], s[k + 4 * c]);
        o[r + 4 * c] = v;
    }
    return o;
}
// Multiply each column by the fixed MixColumns matrix in GF(2^8) ("diffusion").
Block MixColumns(const Block& s) { return mixWith(s, MIX); }
Block InvMixColumns(const Block& s) { return mixWith(s, INV_MIX); }

// XOR the state with a round key.
Block AddRoundKey(Block s, const Block& k) { for (int i = 0; i < 16; i++) s[i] ^= k[i]; return s; }

// Expand the 16-byte key into 11 round keys (44 four-byte words).
std::array<Block, 11> KeyExpansion(const Block& key) {
    std::array<std::array<uint8_t, 4>, 44> w;
    for (int i = 0; i < 4; i++) for (int j = 0; j < 4; j++) w[i][j] = key[4 * i + j];
    for (int i = 4; i < 44; i++) {
        auto temp = w[i - 1];
        if (i % 4 == 0) {
            temp = {temp[1], temp[2], temp[3], temp[0]};   // RotWord
            for (auto& b : temp) b = SBOX[b];               // SubWord
            temp[0] ^= RCON[i / 4];                         // Rcon
        }
        for (int j = 0; j < 4; j++) w[i][j] = w[i - 4][j] ^ temp[j];
    }
    std::array<Block, 11> rk;
    for (int r = 0; r < 11; r++) for (int j = 0; j < 16; j++) rk[r][j] = w[4 * r + j / 4][j % 4];
    return rk;
}

Block encryptBlock(Block s, const Block& key) {
    auto rk = KeyExpansion(key);
    s = AddRoundKey(s, rk[0]);
    for (int round = 1; round <= 10; round++) {
        s = SubBytes(s);
        s = ShiftRows(s);
        if (round < 10) s = MixColumns(s);
        s = AddRoundKey(s, rk[round]);
    }
    return s;
}

Block decryptBlock(Block s, const Block& key) {
    auto rk = KeyExpansion(key);
    s = AddRoundKey(s, rk[10]);
    for (int round = 1; round <= 10; round++) {
        s = InvShiftRows(s);
        s = InvSubBytes(s);
        s = AddRoundKey(s, rk[10 - round]);
        if (round < 10) s = InvMixColumns(s);
    }
    return s;
}

std::string toHex(const Block& b) {
    static const char* d = "0123456789abcdef";
    std::string s;
    for (auto x : b) { s += d[x >> 4]; s += d[x & 15]; }
    return s;
}

Block parseHex(const std::string& v, const std::string& what) {
    std::string clean;
    for (char c : v) if (!std::isspace((unsigned char)c)) clean += c;
    for (char c : clean) if (!std::isxdigit((unsigned char)c)) throw std::runtime_error(what + " must be hex (0-9, a-f).");
    if (clean.size() != 32) throw std::runtime_error(what + " must be exactly 32 hex characters (16 bytes); it has " + std::to_string(clean.size()) + ".");
    Block b;
    for (int i = 0; i < 16; i++) b[i] = uint8_t(std::stoi(clean.substr(2 * i, 2), nullptr, 16));
    return b;
}

// Strict UTF-8 validation (rejects overlongs, surrogates, > U+10FFFF), like TextDecoder({fatal:true}).
bool validUtf8(const Bytes& s) {
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

// Remove zero / PKCS#7 padding and check UTF-8. Empty optional => caller prints hex.
std::optional<std::string> unpadText(const Block& out, const std::string& padding) {
    int end = 16;
    if (padding == "pkcs7") {
        int n = out[15];
        if (n < 1 || n > 16) return std::nullopt;
        for (int i = 16 - n; i < 16; i++) if (out[i] != n) return std::nullopt;
        end = 16 - n;
    } else {
        while (end > 0 && out[end - 1] == 0) end--;
    }
    Bytes b(out.begin(), out.begin() + end);
    if (!validUtf8(b)) return std::nullopt;
    return std::string(b.begin(), b.end());
}

Block padText(const std::string& text, const std::string& padding) {
    if (text.empty()) throw std::runtime_error("Enter a message");
    if (text.size() > 16) throw std::runtime_error("The plaintext is " + std::to_string(text.size()) + " bytes; this single-block demo allows at most 16 bytes.");
    Block b{};
    if (padding == "pkcs7") {
        if (text.size() > 15) throw std::runtime_error("The plaintext is 16 bytes. PKCS#7 always adds at least one padding byte, so the text can be at most 15 bytes. If the data is already a multiple of 16 bytes, PKCS#7 adds a whole extra block of sixteen 10 (hex) bytes. This one-block demo can't show that, so it limits text to 15 bytes.");
        b.fill(uint8_t(16 - text.size()));
    }
    for (size_t i = 0; i < text.size(); i++) b[i] = uint8_t(text[i]);
    return b;
}

int main(int argc, char** argv) {
    buildSbox();
    std::map<std::string, std::string> opt = {{"--format", "hex"}, {"--key-format", "hex"}, {"--padding", "zero"}};
    std::vector<std::string> pos;
    for (int i = 1; i < argc; i++) {
        std::string a = argv[i];
        if (opt.count(a) && i + 1 < argc) opt[a] = argv[++i]; else pos.push_back(a);
    }
    std::string mode = pos.size() > 0 ? pos[0] : "encrypt";
    std::string block = pos.size() > 1 ? pos[1] : "3243f6a8885a308d313198a2e0370734";   // FIPS-197 App. B
    std::string key = pos.size() > 2 ? pos[2] : "2b7e151628aed2a6abf7158809cf4f3c";
    try {
        Block k;
        if (opt["--key-format"] == "text") {
            if (key.size() != 16) throw std::runtime_error("A text key must be exactly 16 bytes; this one is " + std::to_string(key.size()) + " bytes.");
            for (int i = 0; i < 16; i++) k[i] = uint8_t(key[i]);
        } else k = parseHex(key, "The key");
        if (mode == "decrypt") {
            Block out = decryptBlock(parseHex(block, "The ciphertext"), k);
            if (opt["--format"] == "text") { auto t = unpadText(out, opt["--padding"]); if (t) { std::cout << *t << "\n"; return 0; } }
            std::cout << toHex(out) << "\n";
        } else {
            Block in = opt["--format"] == "text" ? padText(block, opt["--padding"]) : parseHex(block, "The plaintext");
            std::cout << toHex(encryptBlock(in, k)) << "\n";
        }
    } catch (const std::exception& e) { std::cerr << "Error: " << e.what() << "\n"; return 1; }
    return 0;
}
