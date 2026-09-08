#!/usr/bin/env bash
set -eo pipefail

echo "========================================================"
echo "    DSH SUPREME - EXECUTE REPRODUCIBLE BENCHMARKS       "
echo "========================================================"

npx tsx dsh-supreme/tests/unit/test-supreme-benchmark.ts

echo "========================================================"
echo "    BENCHMARK RUN COMPLETED - LOGS APPENDED TO DISK    "
echo "========================================================"
