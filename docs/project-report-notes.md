# Project report notes: Kryptonite

**Project name:** Kryptonite — see cryptography step by step  
**Team:** Team Kryptonite  
**Repository:** https://github.com/vishal-1307/kryptonite

## 1. Problem statement
When cryptography is taught in class, each algorithm (Caesar, Vigenère, Playfair, AES, RSA, SHA-256 …) is usually demonstrated with a different website or tool. Switching between tools wastes lecture time, the tools look and behave differently, and most only show the final ciphertext, not *how* it was produced. Students therefore memorise formulas without seeing the internal steps.

## 2. Objectives
1. One web application that covers classical, symmetric, asymmetric, key-exchange, hashing and encoding methods.
2. Let the teacher or student enter their **own** plaintext and key and see the result immediately.
3. Show every intermediate step with an animation and a plain-language explanation, with play / pause / step / speed controls.
4. Be **extensible**: adding a new algorithm should need one new file and one line in a registry, with no changes to the core application.
5. Be correct: verify the implementations against official test vectors.
6. Be easy to use in class: no installation, works on a projector (large mode), on a laptop and on a phone.

## 3. Technology
- HTML, CSS and vanilla JavaScript (ES modules). No framework, no build step, no backend.
- Hosted as a static site (Vercel); all computation happens in the browser.
- Tests with Node.js's built-in test runner (`node --test`).

## 4. Architecture (plugin based)
- **Core** (`core/`): application shell and routing, the automatic input-form builder, validation, and the step player. Written once.
- **Methods** (`methods/`): one file per algorithm. Each exports an object describing its name, category, inputs and actions (`encrypt`, `decrypt`, `hash`, …). Each action returns the output and a list of *steps*.
- **Visuals** (`visuals/`): reusable renderers (alphabet wheel, letter strip, Playfair grid, rail fence, matrix, AES state, hex dump, math lines, tables, bit groups, flow diagram, digest). Methods describe *what* to show; renderers decide *how*.
- **Registry** (`registry.js`): the list of methods. The UI (sidebar, cards, forms, buttons) is generated from it.
- **Shared library** (`lib/`): number theory (gcd, extended Euclid, modular inverse, square-and-multiply) and text/byte helpers.

Design principles: separation of concerns (algorithm vs. presentation), open/closed principle (open for new methods, closed for core changes), pure functions (methods have no DOM code, so they are unit-testable).

See the Mermaid diagram in the README.

## 5. Methods implemented
| Method | Category | What is visualised |
|---|---|---|
| Caesar | Classical | rotating cipher wheel, per-letter (x + k) mod 26, brute-force attack ranking all 26 keys by χ² English score |
| Vigenère | Classical | repeating key, the row of the Vigenère square used for each letter |
| Playfair | Classical | building the 5×5 key square, digraph preparation (X fillers), same-row / same-column / rectangle rules on the grid |
| Rail Fence | Classical | zigzag writing on N rails and reading rail by rail (and the reverse) |
| Hill (2×2) | Classical | key matrix and determinant check, matrix × vector mod 26, inverse key for decryption |
| AES-128 | Symmetric | state loading, key expansion (RotWord, SubWord, Rcon), all 10 rounds of SubBytes, ShiftRows, MixColumns (with GF(2⁸) arithmetic for a column) and AddRoundKey; inverse cipher for decryption |
| RSA | Asymmetric | p, q, n, φ(n), choice of e, d by the extended Euclidean algorithm, encryption/decryption with square-and-multiply tables |
| Diffie–Hellman | Key exchange | Alice / public channel / Bob diagram, public keys, shared secret, why an eavesdropper is stuck (discrete log) |
| SHA-256 | Hashing | UTF-8 bytes, padding, message schedule W₀–W₆₃, a compression round in detail, all 64 rounds, final digest, avalanche effect |
| Base64 | Encoding | 3 bytes → 4 six-bit groups → characters, padding; clearly labelled as *not* encryption |

## 6. Testing and verification
- AES-128 matches FIPS-197 Appendix B (including round-1 intermediate values) and Appendix C.1, and 25 random blocks against Node.js's OpenSSL-based AES.
- SHA-256 matches the standard vectors for "", "abc" and the 448-bit NIST message, and Node.js's SHA-256 for padding edge cases and Unicode input.
- RSA reproduces the textbook example (p = 61, q = 53, e = 17 → d = 2753; 65 → 2790).
- Diffie–Hellman reproduces p = 23, g = 5, a = 4, b = 3 → shared secret 18.
- Classical ciphers match textbook examples (LEMON, "playfair example", WEAREDISCOVERED, HELP → HIAT) and round-trip for many keys.
- A contract test runs every registered method and checks that it returns well-formed steps.
- Browser check: every step of every method was rendered in headless Chrome without errors; screenshots taken at desktop (1440 px) and mobile (390 px) widths.

## 7. Limitations
- AES encrypts a single 16-byte block (no modes such as CBC/GCM); RSA uses small primes and no padding; Hill supports 2×2 keys only. These are deliberate simplifications so every step can be shown.
- The tool is for teaching, not for protecting real data.

## 8. Future scope
- More methods: DES / 3DES, ChaCha20, ECC (point addition on a small curve), ElGamal, HMAC, MD5 / SHA-1 (to discuss broken hashes), AES modes (ECB vs CBC "penguin" demo), digital signatures.
- Attacks: frequency analysis for Vigenère (Kasiski / index of coincidence), known-plaintext attack on Hill, factoring small RSA moduli.
- Quiz mode: hide the next step and let students predict it.
- Compare mode: run two methods side by side.
- Export a step as an image or PDF for notes; shareable links with inputs in the URL.
- Hindi / regional-language explanations.
