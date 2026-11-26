// Kryptonite - Vigenere cipher (C++17, standard library only).
//
// Build & run:
//   g++ -std=c++17 -O2 vigenere.cpp -o vigenere && ./vigenere
//   ./vigenere encrypt "attack at dawn" lemon
//   ./vigenere decrypt "LXFOPV EF RNHR" LEMON
// Only A-Z / a-z are shifted (case kept). Non-letters are copied unchanged and do
// NOT advance the key position.
#include <iostream>
#include <stdexcept>
#include <string>

// Keep only A-Z, uppercased.
std::string cleanKey(const std::string& key) {
    std::string k;
    for (char c : key) {
        if (c >= 'a' && c <= 'z') c = char(c - 32);
        if (c >= 'A' && c <= 'Z') k += c;
    }
    return k;
}

// Shift each letter by the next key letter; j only advances on letters.
std::string vigenere(const std::string& text, const std::string& key, bool decrypting) {
    std::string k = cleanKey(key);
    if (k.empty()) throw std::runtime_error("The key must contain at least one letter.");
    std::string out;
    size_t j = 0;
    for (char ch : text) {
        bool upper = ch >= 'A' && ch <= 'Z', lower = ch >= 'a' && ch <= 'z';
        if (!upper && !lower) { out += ch; continue; }
        int s = k[j % k.size()] - 'A';
        j++;
        char base = upper ? 'A' : 'a';
        int x = ch - base;
        int y = decrypting ? (x - s + 26) % 26 : (x + s) % 26;
        out += char(base + y);
    }
    return out;
}

int main(int argc, char** argv) {
    std::string mode = "encrypt", text = "ATTACK AT DAWN", key = "LEMON";
    if (argc > 1) mode = argv[1];
    if (argc > 2) text = argv[2];
    if (argc > 3) key = argv[3];
    if (text.empty()) { std::cerr << "Error: Enter a message\n"; return 1; }
    try {
        std::cout << vigenere(text, key, mode == "decrypt") << "\n";
    } catch (const std::exception& e) { std::cerr << "Error: " << e.what() << "\n"; return 1; }
    return 0;
}
