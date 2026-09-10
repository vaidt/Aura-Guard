# Regression tests

Deterministic node-runnable tests for the Aura-Guard verification, format and
export libraries. No browser or bundler required.

```
cd /app
node --test frontend/tests/verification.test.mjs
```

Covers:
- Valid session with `{ decisions: [...] }`
- Malformed / missing `decisions`
- Decisions with optional / missing fields
- Hash-chain data used by the visual diagram (`next.prev_hash === prev.chain_hash`)
- Tamper cascades (SHA-256 fail on tampered row; hash-chain fail on next row)
- Evidence bundle export shape (session preserved; no invented audit fields;
  `source: imported | synthesized-from-source`)
