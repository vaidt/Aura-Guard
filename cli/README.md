# aura-verify — standalone evidence verifier

Independently verifies an Aura-Guard evidence bundle without any browser, UI
state, or database. Reuses the same **Conformance Core** module the console
uses, so CLI and UI produce identical results for the same bundle by
construction.

## Usage

```
node /app/cli/aura-verify.mjs <bundle.json>          # human-readable
node /app/cli/aura-verify.mjs <bundle.json> --json   # machine-readable
```

Exit codes: **0** PASS · **1** FAIL · **2** bad input.

## Guarantees

- Read-only. The bundle file is never mutated.
- No new cryptographic semantics — canonicalization + SHA-256 primitives are
  loaded from `frontend/src/lib/verification.js` unchanged.
- Signed attestation is **NOT** implemented (out of scope until a normative
  signature specification exists).

## Portability test

See `/app/frontend/tests/portability.test.mjs`. It:

1. Loads the built-in sample session, exports the bundle exactly as the UI
   does, and runs the CLI end-to-end — expecting **PASS**.
2. Tampers a field inside the exported bundle file on disk, re-runs the CLI —
   expecting **FAIL** with the correct check identifying the mutation.
3. Cross-checks CLI output against the UI's `runConformanceSuite()` on the
   same bundle — asserting per-test status equality.
