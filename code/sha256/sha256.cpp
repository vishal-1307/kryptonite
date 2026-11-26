// Kryptonite - SHA-256 implemented by hand (C++17, standard library only).
//
// Build & run:
//   g++ -std=c++17 -O2 sha256.cpp -o sha256 && ./sha256
//   ./sha256 "hello"
// Output: the 64-hex-character digest of the UTF-8 bytes of the argument.
#include <array>
#include <cstdint>
#include <cstdio>
#include <iostream>
#include <string>
#include <vector>

const uint32_t K[64] = {
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2};
const uint32_t H0[8] = {0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19};

// Rotate a 32-bit word right by n bits.
uint32_t rotr(uint32_t x, int n) { return (x >> n) | (x << (32 - n)); }

// Append 0x80, zeros, and the 64-bit big-endian bit length (multiple of 64 bytes).
std::vector<uint8_t> pad(const std::string& msg) {
    std::vector<uint8_t> out(msg.begin(), msg.end());
    uint64_t bitLen = uint64_t(msg.size()) * 8;
    out.push_back(0x80);
    while (out.size() % 64 != 56) out.push_back(0);
    for (int i = 7; i >= 0; i--) out.push_back(uint8_t(bitLen >> (8 * i)));
    return out;
}

// Message schedule W0..W63 for one 64-byte block.
std::array<uint32_t, 64> messageSchedule(const uint8_t* blk) {
    std::array<uint32_t, 64> W;
    for (int t = 0; t < 16; t++) W[t] = (uint32_t(blk[4 * t]) << 24) | (uint32_t(blk[4 * t + 1]) << 16) | (uint32_t(blk[4 * t + 2]) << 8) | blk[4 * t + 3];
    for (int t = 16; t < 64; t++) {
        uint32_t s0 = rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >> 3);
        uint32_t s1 = rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >> 10);
        W[t] = W[t - 16] + s0 + W[t - 7] + s1;
    }
    return W;
}

// 64 rounds on registers a..h, then the feed-forward addition into H.
void compress(std::array<uint32_t, 8>& H, const uint8_t* blk) {
    auto W = messageSchedule(blk);
    uint32_t a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (int t = 0; t < 64; t++) {
        uint32_t S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        uint32_t ch = (e & f) ^ (~e & g);
        uint32_t T1 = h + S1 + ch + K[t] + W[t];
        uint32_t S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        uint32_t maj = (a & b) ^ (a & c) ^ (b & c);
        uint32_t T2 = S0 + maj;
        h = g; g = f; f = e; e = d + T1; d = c; c = b; b = a; a = T1 + T2;
    }
    uint32_t v[8] = {a, b, c, d, e, f, g, h};
    for (int i = 0; i < 8; i++) H[i] += v[i];
}

std::string sha256(const std::string& msg) {
    std::array<uint32_t, 8> H;
    for (int i = 0; i < 8; i++) H[i] = H0[i];
    auto p = pad(msg);
    for (size_t off = 0; off < p.size(); off += 64) compress(H, p.data() + off);
    std::string out;
    char buf[9];
    for (auto x : H) { std::snprintf(buf, sizeof buf, "%08x", x); out += buf; }
    return out;
}

int main(int argc, char** argv) {
    std::string text = argc > 1 ? argv[1] : "abc";
    std::cout << sha256(text) << "\n";
    return 0;
}
