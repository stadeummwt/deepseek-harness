#!/usr/bin/env bash
set -eo pipefail

echo "========================================================"
echo "      DSH SUPREME - VERIFY ALL REGRESSION SUITE        "
echo "========================================================"

# Run full TypeScript master test matrix
npx tsx dsh-supreme/tests/run-all-tests.ts

echo "========================================================"
echo "    VERIFY ALL SUCCESSFUL - 100% REGRESSION PASSED      "
echo "========================================================"
