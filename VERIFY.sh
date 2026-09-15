#!/bin/sh
# Vouch Harbor — zero-dependency verification (18.4.0).
#
# For the reviewer on a machine WITHOUT node_modules and WITHOUT network
# (the 18.3.0 review could not reproduce the gates because the archive ships
# no dependency tree). Exactly one gate needs nothing but Node >= 20:
# the offline verification pack — 111 pre-bundled probe suites, zero install,
# zero network.
#
# The protocol selftest (`node protocol/test/selftest.js`) is NOT zero-dep
# (it needs @hpke/core); run it after `cd protocol && npm install`. The full
# dev gates are listed in RELEASE-VERIFICATION.md and reproduce after
# `npm install` at the root.
set -e
echo "== offline verification pack — 111 suites, zero deps, zero network =="
node verify/run.mjs
