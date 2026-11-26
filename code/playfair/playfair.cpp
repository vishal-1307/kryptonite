// Kryptonite - Playfair cipher (C++17, standard library only).
//
// Build & run:
//   g++ -std=c++17 -O2 playfair.cpp -o playfair && ./playfair
//   ./playfair encrypt "balloon" monarchy
//   ./playfair decrypt "IBSUPMNA" monarchy
// Only A-Z are used (uppercased), J becomes I, X (or Q after X) is inserted between
// doubled letters and pads an odd final letter. Decryption keeps the fillers.
#include <array>
#include <iostream>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

// Keep only A-Z, uppercased.
std::string onlyLetters(const std::string& s) {
    std::string r;
    for (char c : s) {
        if (c >= 'a' && c <= 'z') c = char(c - 32);
        if (c >= 'A' && c <= 'Z') r += c;
    }
    return r;
}

std::string jToI(std::string s) { for (char& c : s) if (c == 'J') c = 'I'; return s; }

struct Square {
    std::array<std::array<char, 5>, 5> grid{};
    std::array<std::pair<int, int>, 26> pos{};
};

// Build the 5x5 square: key letters first (no repeats, J->I), then the rest of A-Z without J.
Square keySquare(const std::string& key) {
    Square sq;
    bool seen[26] = {false};
    int n = 0;
    for (char ch : jToI(onlyLetters(key) + "ABCDEFGHIKLMNOPQRSTUVWXYZ")) {
        if (seen[ch - 'A']) continue;
        seen[ch - 'A'] = true;
        sq.grid[n / 5][n % 5] = ch;
        sq.pos[ch - 'A'] = {n / 5, n % 5};
        n++;
    }
    return sq;
}

// Split plaintext into pairs, inserting X (or Q) fillers for doubled and odd letters.
std::vector<std::pair<char, char>> prepare(const std::string& text) {
    std::string s = jToI(onlyLetters(text));
    std::vector<std::pair<char, char>> pairs;
    size_t i = 0;
    while (i < s.size()) {
        char a = s[i];
        char filler = a == 'X' ? 'Q' : 'X';
        if (i + 1 >= s.size() || s[i + 1] == a) { pairs.push_back({a, filler}); i += 1; }
        else { pairs.push_back({a, s[i + 1]}); i += 2; }
    }
    return pairs;
}

// Same row: letter to the right (left when decrypting); same column: below (above); else rectangle.
std::string transformPair(char a, char b, const Square& sq, int d) {
    auto [r1, c1] = sq.pos[a - 'A'];
    auto [r2, c2] = sq.pos[b - 'A'];
    auto m = [](int x) { return (x + 5) % 5; };
    std::string out;
    if (r1 == r2) { out += sq.grid[r1][m(c1 + d)]; out += sq.grid[r2][m(c2 + d)]; }
    else if (c1 == c2) { out += sq.grid[m(r1 + d)][c1]; out += sq.grid[m(r2 + d)][c2]; }
    else { out += sq.grid[r1][c2]; out += sq.grid[r2][c1]; }
    return out;
}

std::string encrypt(const std::string& text, const std::string& key) {
    Square sq = keySquare(key);
    auto pairs = prepare(text);
    if (pairs.empty()) throw std::runtime_error("Enter a message containing letters.");
    std::string out;
    for (auto [a, b] : pairs) out += transformPair(a, b, sq, 1);
    return out;
}

std::string decrypt(const std::string& text, const std::string& key) {
    Square sq = keySquare(key);
    std::string s = jToI(onlyLetters(text));
    if (s.size() % 2) throw std::runtime_error("Playfair ciphertext must have an even number of letters.");
    std::string out;
    for (size_t i = 0; i < s.size(); i += 2) {
        if (s[i] == s[i + 1]) throw std::runtime_error(std::string("\"") + s[i] + s[i + 1] + "\" cannot appear in valid Playfair ciphertext (a pair never has two equal letters).");
        out += transformPair(s[i], s[i + 1], sq, -1);
    }
    return out;
}

int main(int argc, char** argv) {
    std::string mode = "encrypt", text = "Hide the gold in the tree stump", key = "playfair example";
    if (argc > 1) mode = argv[1];
    if (argc > 2) text = argv[2];
    if (argc > 3) key = argv[3];
    if (text.empty()) { std::cerr << "Error: Enter a message\n"; return 1; }
    try {
        std::cout << (mode == "encrypt" ? encrypt(text, key) : decrypt(text, key)) << "\n";
    } catch (const std::exception& e) { std::cerr << "Error: " << e.what() << "\n"; return 1; }
    return 0;
}
