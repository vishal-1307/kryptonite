# Optional step fields (for the UI)

Every step is still `{ title, explanation, visual }` and every existing visual renders unchanged.
The `methods-fixes` branch adds **optional** data that the UI may use for animations and focus.
Nothing is required: a renderer that ignores these fields behaves exactly as before.

* New data lives in `step.meta` (a plain JSON object; never BigInt — large numbers are **strings**).
* A few visuals gained optional keys inside `visual.data` (listed below). Unknown keys are ignored by the current renderers.
* Some method results gained extra top-level keys (`issues` for Diffie–Hellman). `core/contract.js` ignores them.

Coordinates: `row`/`col` are 0-based. `index`/`charIndex` are 0-based positions in the input as **code points** (`[...text]`), the same indexing the `textRows` cells use.

## Caesar (`caesar`)
| Step | `meta` |
|---|---|
| first step | `{ shift, effectiveShift, passThroughCount }` — characters copied unchanged |
| each letter step | `{ charIndex, letterNumber, inValue, outValue, shift }` |

## Vigenère (`vigenere`)
| Step | `meta` |
|---|---|
| "Repeat the key…" | `{ key, keyLength, passThroughCount }` (`key` = letters only, uppercased) |
| each letter step | `{ charIndex, letterNumber, keyLetter, keyIndex, keyLength, shift, inValue, outValue }` |

`keyIndex` is the 0-based position inside the key. **The key does not advance on non-letters**, so `charIndex` can jump while `keyIndex` goes 0,1,2…

## Playfair (`playfair`)
| Step | Field |
|---|---|
| "Split the message into pairs" | `visual.data.fillerPairs: number[]` — indexes of pairs whose **second** letter is an inserted filler |
| same step | `meta: { pairs: string[], fillers: [{ pair, letter, reason: 'double'|'odd', doubled? }], jToI, droppedChars }` |
| each pair step | `meta: { pairIndex, pair: [a,b], out: [x,y], rule: 'Same row'|'Same column'|'Rectangle', inCells: [[r,c],[r,c]], outCells: [[r,c],[r,c]], isFiller: [bool,bool] }` |

`inCells` = grid cells of the input pair (same as `visual[0].data.primary`), `outCells` = cells of the output pair (same as `secondary`). Decryption steps have `isFiller: [false,false]` (fillers cannot be detected from ciphertext).

## Rail Fence (`railfence`)
Every "Write characters…", "Read rail…", "Fill rail…" and "Read the zigzag" step has
```js
meta: { rails, cols, active: [{ index, row, col, ch }], focus: { index, row, col, ch } | null }
```
`active` = the characters highlighted in this step; `focus` = the last of them (scroll it into view, e.g. keep column `focus.col` visible when the fence scrolls horizontally). `col === index`.

## Hill (`hill`)
| Step | `meta` |
|---|---|
| "Key matrix" | `{ key: [[a,b],[c,d]], det, detInverse, invertible: true }` |
| "Split into pairs" | `{ prepared, padded, pairs: string[] }` |
| each block step | see below |

```js
meta: {
  pairIndex, matrixName: 'K' | 'K⁻¹', matrix: [[a,b],[c,d]],
  input:  { letters: 'HE', vector: [7, 4] },
  rows: [   // one per matrix row
    { terms: [{ k: 3, x: 7, product: 21 }, { k: 3, x: 4, product: 12 }], sum: 33, result: 7, letter: 'H' },
    { terms: [{ k: 2, x: 7, product: 14 }, { k: 5, x: 4, product: 20 }], sum: 34, result: 8, letter: 'I' },
  ],
  output: { letters: 'HI', vector: [7, 8] },
  isPadding: [false, false],   // [false, true] when the 2nd letter is the padding X
}
```
All values are plain Numbers and exact: matrix entries are reduced to 0–25 (with BigInt when the typed key is huge), so a product is ≤ 625 and a sum ≤ 1250.

## AES-128 (`aes`)
* New input `padding` (`'zero'` default | `'pkcs7'`), used only when the plaintext format is Text. The form is generated from `inputs`, so it appears automatically.
* "Load the … into the state": `meta: { inputBytes, textBytes, textChars, padding: 'zero'|'pkcs7'|'none', paddedBytes }`.
* "Plaintext recovered" / "Ciphertext": `meta: { outputHex, strippedBytes }`.
* When decrypting in Text format, the **output** is the raw 32-hex block if the bytes are not valid UTF-8 or not valid PKCS#7; `outputLabel` says so.

## RSA (`rsa`) — all numbers are strings
* "Find d …": `meta.euclid = { phi, e, rows: [{ index, quotient|null, remainder, t, tTimesEModPhi }], currentRow, lastT, d }`. `quotient` is `null` for the two starting rows. The table uses the r/t form (r = remainder, t = coefficient of e; r ≡ t·e mod φ). The s coefficient (of φ) is not needed for d and is not tracked.
* "The key pair": `meta: { publicKey: { n, e }, privateKey: { n, d }, secret: { p, q, phi } }`.
* Each "Encrypt/Decrypt block i…" step: `meta.modPow = { base, exponent, modulus, bits, result, blockIndex, progress: [{ bitIndex, bit, base, accBefore, squared, multiplied|null, acc }] }` — left-to-right square-and-multiply, one entry per exponent bit (most significant first): `squared = accBefore² mod n`, then if `bit === '1'` `multiplied = squared · base mod n`; `acc` is the running value after the bit.
* New step "Textbook RSA vs real-world RSA" (encrypt only, after "Why textbook RSA is unsafe").

## Diffie–Hellman (`diffiehellman`)
* `meta.exchange` on the protocol steps:
  ```js
  { public: ['p','g','A','B'],            // names Eve can see at this point
    secret: ['a','b'] | [{ name, owner, value }],
    computed?: [{ name: 'A', by: 'Alice', formula: 'g^a mod p', value: '4' }, …],
    messages: [{ from: 'Alice', to: 'Bob', name: 'A', value: '4', public: true }, …] }   // only on "Swap public keys"
  ```
* "Check the generator g": `meta: { order, pMinus1, primitiveRoot, safePrimeSubgroup, smallSubgroup }`.
* `validate()` now refuses: a or b outside 2…p−2, g of order ≤ 2 (incl. g = p−1), and any combination with A = 1, B = 1 or shared secret = 1.
* If `exchange()` is called directly with such values, the first step is "⚠ Degenerate parameters" with `meta.issues`, the result carries `issues: [{ code, severity, message }]` and `outputLabel` warns.

## SHA-256 (`sha256`)
* "Compression round 0": `meta: { block, round: 0, before: {a..h}, after: {a..h}, T1, T2 }` (8-hex-digit strings).
* New step "Registers a…h in selected rounds": `meta: { block, rounds: [{ t, before: {a..h}, after: {a..h}, T1, T2 }], newRegisters: ['a','e'], shiftedRegisters: { b:'a', c:'b', d:'c', f:'e', g:'f', h:'g' } }` for t ∈ 0, 1, 2, 3, 15, 31, 47, 63. Its table has `visual.data.highlightCols: [1, 5]` (the a and e columns; optional).
* "All 64 rounds": `meta.registers = [{ t, a, b, c, d, e, f, g, h }]` for all 64 rounds.
* "Avalanche effect": `meta: { inputBitsChanged: 1 | null, outputBitsChanged, flippedByte, flippedBit }`. For empty input there is no bit to flip; `inputBitsChanged` is `null` and the text says it compares with the 1-byte input 01.

## Base64 (`base64`)
* Decode group steps now draw **Characters → Sextets → Bytes** (`visual.data.groups` in that order, plus `visual.data.direction: 'decode'`), and carry
  ```js
  meta: { groupIndex, order: ['chars','sextets','bytes'],
          chars: ['T','W','F','u'],
          sextets: [{ char, index, bits } | null],      // null for '='
          bytes: [{ value, hex, bits }],
          droppedBits: '0000' }                         // leftover zero bits after the last full byte
  ```
  Note: `visuals/bits.js` only marks padding bits when a later group is longer, so in decode order it no longer draws the "dropped bits" note; `meta.droppedBits` has that information.
* Decode output is byte-exact: a UTF-8 BOM is kept (extra step "Starts with a UTF-8 byte-order mark", `meta.bom`), and non-UTF-8 data is output as **hex** (no spaces). Result step `meta: { bytes, hex, utf8, bom }`.
* Encode result step: `meta: { inputBytes, outputChars, bom }`.

## code/manifest.json (Code tab)
Keyed by method id (`caesar`, `vigenere`, `playfair`, `railfence`, `hill`, `aes`, `rsa`, `diffiehellman`, `sha256`, `base64`):
```js
{ folder, warning,
  python: { file, deps, install, run, usage, sampleInput: { action, ...values }, expectedOutput, notes: [{ fn, what }] },
  cpp:    { …same },
  pythonLibrary?: { …same, route: 'library' } }   // aes (cryptography) and sha256 (hashlib)
```
`file` is relative to `code/`. `run` assumes the current directory is the method folder. Regenerate with `node code/make-manifest.mjs`; `sh code/verify.sh` checks it.
