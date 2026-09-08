#!/usr/bin/env bash
set -eo pipefail

echo "========================================================"
echo "    DSH SUPREME - VERIFY SECURITY & REDACTION SUITE     "
echo "========================================================"

npx tsx dsh-supreme/tests/integration/test-security-redaction.ts

echo "========================================================"
echo "    SECURITY VERIFICATION PASSED - ZERO LEAKS DETECTED  "
echo "========================================================"
