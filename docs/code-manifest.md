# `code/manifest.json` — schema read by the Code tab

The Code tab (`core/code-tab.js`, parsing in `core/code-manifest.js`) fetches `code/manifest.json` once and then the
source file for the chosen language. Nothing is executed; files are shown, highlighted and copied byte-for-byte.

```jsonc
{
  "<methodId>": {                       // registry id, e.g. "aes"; a { "methods": { … } } wrapper is also accepted
    "folder":  "aes128",                // optional: shown as "Run these inside code/aes128/"
    "warning": "Educational code …",    // optional: shown above the code
    "python":  { …entry },              // aliases: python3, py
    "cpp":     { …entry },              // aliases: c++, cpp17, c++17, cxx
    "pythonLibrary": { …entry }         // optional third choice, labelled "Python (library)"; shown only when present
  }
}
```

An entry (every field except `file` is optional):

| field | type | rendered as |
|---|---|---|
| `file` | string, relative to `code/` (`"aes128/aes128.py"`; a leading `code/` or `./` is tolerated) | filename, fetched source. Absolute URLs and `..` are refused. Entries without `file` are skipped. |
| `deps` | string[] or `{name, version}`[] | "Dependencies" list |
| `install` | string or string[] | one row per command, each with its own Copy button; prose such as "none (standard library only)" is shown as text without a Copy button |
| `run` | string (lines split on `\n`) or string[] | "Compile and run" (C++) / "Run" rows with Copy buttons |
| `usage` | string | "Usage" command line |
| `sampleInput` | object (labelled key/value list) or string | "Sample input" |
| `expectedOutput` | string | "Expected output" |
| `notes` | `{fn, what}`[] (also strings or an `{fn: what}` object) | "Functions": `fn` in monospace, then `what` |

Missing method, missing language or a failed fetch shows "Code coming soon" (or the fetch error) instead of a broken panel.
A core language (Python 3, C++17) without an entry is shown disabled; the optional library entry is hidden when absent.

For local testing the base folder can be pointed elsewhere: `localStorage['cv-code-base'] = 'tests/fixtures/code/'`
(the fixture in `tests/fixtures/code/` exercises every accepted shape; see `tests/ui.test.mjs`).
