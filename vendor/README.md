# In-browser code runners

These files power the Run button on the Code tab. They load only when the user first clicks Run.

## Python (self-hosted)

`vendor/pyodide/` is [Pyodide 0.29.5](https://github.com/pyodide/pyodide) (Mozilla Public License 2.0): `pyodide.mjs`, `pyodide.asm.js`, `pyodide.asm.wasm`, `python_stdlib.zip`, and `pyodide-lock.json`.

Uncompressed size on disk: about **12.3 MB** (8.6 MB wasm + 2.4 MB stdlib + 1.1 MB asm.js glue + lock file). That is small enough to ship with the static site on Vercel. No extra Python packages are included; the programs use the standard library only.

## C++ (client-side Clang, toolchain from a CDN)

`vendor/clang-in-browser/` is [clang-in-browser](https://github.com/devtoolry/clang-in-browser) (MIT) plus its copy of [tiny-wasi-host](https://github.com/devtoolry/tiny-wasi-host) (MIT). The worker compiles C++17 to `wasm32-wasi` with [YoWASP Clang 21.1.4-3](https://github.com/YoWASP/clang) (ISC; LLVM is Apache-2.0 with LLVM exceptions) and runs the result in the browser.

The exception-handler stub `assets/eh.cpp` is self-hosted (WASI libc++abi has no exception runtime; the stub lets `throw` abort cleanly). The YoWASP toolchain itself is **not** self-hosted: the unpacked files are about **102 MB** (`llvm.core.wasm` 72.7 MB + `llvm-resources.tar` 29.6 MB), which is over a typical Vercel Hobby deployment limit (100 MB). The npm tarball is **26.4 MB** compressed (main wasm ~21.9 MB gzipped + resources ~4.3 MB gzipped). On the first C++ Run the worker downloads it from `https://cdn.jsdelivr.net/npm/@yowasp/clang@21.1.4-3/` and the browser caches it. Your source stays in the browser; this is not a remote compile API.

JSCPP was not used: our programs need C++17 (`std::optional`, `<array>`, structured bindings) which that interpreter does not reliably provide.
