#!/bin/sh
# Compile and run every code/ program and compare its output with Kryptonite's JavaScript methods.
# Requires node 18+, python3 and g++ (C++17). Run from anywhere: sh code/verify.sh
set -e
cd "$(dirname "$0")/.."
exec node code/verify.mjs "$@"
