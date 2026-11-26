// Kryptonite - Caesar cipher (C++17, standard library only).
//
// Build & run:
//   g++ -std=c++17 -O2 caesar.cpp -o caesar && ./caesar
//   ./caesar encrypt "Hello" 7
//   ./caesar decrypt "Olssv" 7
// Output: the result text on one line. Only A-Z / a-z are shifted (case kept);
// every other byte (spaces, digits, UTF-8 multi-byte characters) is copied unchanged.
#include <iostream>
#include <string>

// Shift one ASCII letter by k places (wrapping); anything else is unchanged.
char shiftChar(char ch, int k) {
    if (ch >= 'A' && ch <= 'Z') return char((ch - 'A' + k) % 26 + 'A');
    if (ch >= 'a' && ch <= 'z') return char((ch - 'a' + k) % 26 + 'a');
    return ch;
}

// Apply shiftChar to every byte. k must already be in 0..25.
std::string shiftText(const std::string& text, int k) {
    std::string out = text;
    for (char& c : out) c = shiftChar(c, k);
    return out;
}

int mod26(long long x) { return int(((x % 26) + 26) % 26); }

// E(x) = (x + k) mod 26
std::string encrypt(const std::string& text, long long shift) { return shiftText(text, mod26(shift)); }
// D(x) = (x - k) mod 26
std::string decrypt(const std::string& text, long long shift) { return shiftText(text, mod26(-mod26(shift))); }

int main(int argc, char** argv) {
    std::string mode = "encrypt", text = "Attack at dawn";
    long long shift = 3;
    if (argc > 1) mode = argv[1];
    if (argc > 2) text = argv[2];
    if (argc > 3) shift = std::stoll(argv[3]);
    if (text.empty()) { std::cerr << "Error: Enter a message\n"; return 1; }
    if (mode == "encrypt") std::cout << encrypt(text, shift) << "\n";
    else if (mode == "decrypt") std::cout << decrypt(text, shift) << "\n";
    else { std::cerr << "Error: mode must be encrypt or decrypt\n"; return 1; }
    return 0;
}
