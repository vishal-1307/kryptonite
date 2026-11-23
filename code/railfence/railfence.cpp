// Kryptonite - Rail Fence cipher (C++17, standard library only).
//
// EDUCATIONAL CODE ONLY. Rail Fence has very few keys and is trivially
// brute-forced. Never use it to protect real data; use a vetted library instead.
//
// Build & run:
//   g++ -std=c++17 -O2 railfence.cpp -o railfence && ./railfence
//   ./railfence encrypt "Hello world" 4
//   ./railfence decrypt "WECRLTEERDSOEEFEAOCAIVDEN" 3
// Works on Unicode characters (UTF-8 code points), not bytes, so é or 🔐 move as one unit.
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>

// Split a UTF-8 string into code points (each kept as its UTF-8 byte sequence).
std::vector<std::string> splitUtf8(const std::string& s) {
    std::vector<std::string> out;
    for (size_t i = 0; i < s.size();) {
        unsigned char c = (unsigned char)s[i];
        size_t len = c < 0x80 ? 1 : (c >> 5) == 6 ? 2 : (c >> 4) == 14 ? 3 : (c >> 3) == 30 ? 4 : 1;
        if (i + len > s.size()) len = 1;
        out.push_back(s.substr(i, len));
        i += len;
    }
    return out;
}

// Rail index (row) of each position when writing down and up across `rails` rows.
std::vector<int> zigzag(size_t len, int rails) {
    std::vector<int> rows;
    int r = 0, d = 1;
    for (size_t i = 0; i < len; i++) {
        rows.push_back(r);
        if (r == 0) d = 1; else if (r == rails - 1) d = -1;
        r += d;
    }
    return rows;
}

// Write in a zigzag, then read rail by rail.
std::string encrypt(const std::string& text, int rails) {
    auto chars = splitUtf8(text);
    auto rows = zigzag(chars.size(), rails);
    std::string out;
    for (int r = 0; r < rails; r++)
        for (size_t i = 0; i < chars.size(); i++) if (rows[i] == r) out += chars[i];
    return out;
}

// Mark the zigzag, fill each rail with the next ciphertext characters, then read the zigzag.
std::string decrypt(const std::string& text, int rails) {
    auto chars = splitUtf8(text);
    auto rows = zigzag(chars.size(), rails);
    std::vector<std::string> res(chars.size());
    size_t k = 0;
    for (int r = 0; r < rails; r++)
        for (size_t i = 0; i < rows.size(); i++) if (rows[i] == r) res[i] = chars[k++];
    std::string out;
    for (auto& c : res) out += c;
    return out;
}

int main(int argc, char** argv) {
    std::string mode = "encrypt", text = "WEAREDISCOVEREDFLEEATONCE";
    int rails = 3;
    if (argc > 1) mode = argv[1];
    if (argc > 2) text = argv[2];
    if (argc > 3) rails = std::stoi(argv[3]);
    if (text.empty()) { std::cerr << "Error: Enter a message\n"; return 1; }
    if (rails < 2) { std::cerr << "Error: Rails must be a whole number of at least 2.\n"; return 1; }
    std::cout << (mode == "encrypt" ? encrypt(text, rails) : decrypt(text, rails)) << "\n";
    return 0;
}
