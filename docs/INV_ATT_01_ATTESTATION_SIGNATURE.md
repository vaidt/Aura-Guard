# INV-ATT-01 — Attestation Signature (v1.0)

**IMPLEMENTATION-LEVEL, NON-NORMATIVE — PENDING AURA PROTOCOL SPECIFICATION**

Binding matrix row: `INV-ATT-01` (see `binding_matrix.json`).
Requirement: `REQ-ATT-01`.
Executable check: `impl:attestation-signature` → `checkAttestationSignature`.

## Purpose

Allow a bundle to be cryptographically attested by a signer whose public key
is registered in an **out-of-band trusted key registry**, so an independent
third-party verifier — one that never trusted the producer's runtime — can
prove:

1. The bundle's session content (record count, final chain hash, policy set)
   has not changed since attestation.
2. The signer was in possession of a private key whose public counterpart is
   currently trusted.
3. The attestation was issued while that key was inside its validity window
   and not revoked.

## Algorithm

**Ed25519** (RFC 8032). Rationale:
- Deterministic signatures — matches the deterministic ethos of the rest of
  the Conformance Core.
- Small (32-byte public key, 64-byte signature).
- Native in Node ≥ 12 and every conforming ECMAScript Web Crypto engine
  (Chrome ≥ 113, Safari ≥ 17, Firefox ≥ 130, Node ≥ 20 webcrypto).
- Reference verifier reproducible in pure-Python stdlib
  (`/app/py_verifier/ed25519_ref.py`, ~90 lines derived from RFC 8032
  Appendix A) — preserves the stdlib-only property of the Python verifier.

Signature is computed over the raw UTF-8 bytes of the canonical signed
payload (see below). Ed25519 internally hashes with SHA-512 per RFC 8032.

## Canonical signed payload

The signer canonicalizes (JCS-lite + INV-FLT-01) exactly this object:

```json
{
  "algorithm": "ed25519",
  "aura_attestation_version": "1.0",
  "bundle_version": 1,
  "final_chain_hash": "<hex64 — chain_hash of the last decision>",
  "genesis_hash": "0000000000000000000000000000000000000000000000000000000000000000",
  "key_id": "<signer key id>",
  "record_count": <int>,
  "registered_policy_versions": ["<sorted array of registered policy versions>"],
  "session_id": "<session identifier or empty string>",
  "signed_at": "<RFC 3339 UTC timestamp>"
}
```

`registered_policy_versions` MUST be sorted lexicographically to remove
producer-order ambiguity. The verifier reconstructs the entire payload from
the bundle (plus `key_id` + `signed_at` taken from the attestation block)
and compares canonicalized bytes to `attestation.signed_payload`
BYTE-FOR-BYTE. Any drift → FAIL.

## Wire format

Bundles gain one optional top-level object:

```json
{
  "bundle_version": 1,
  "session": { ... },
  "attestation": {
    "attestation_version": "1.0",
    "algorithm": "ed25519",
    "key_id": "aura-key-2026Q1-demo-001",
    "signed_at": "2026-02-02T12:00:00Z",
    "signed_payload": "<canonical JSON string, exactly as signed>",
    "signature": "<128 hex chars, 64 raw bytes>"
  }
}
```

The trusted key registry is **NOT** carried inside the bundle. That would
defeat third-party attestation (the producer could ship any key claiming it
is trusted). The verifier consults an out-of-band registry:
- JS: `DEFAULT_SIGNING_KEY_REGISTRY` in `/app/frontend/src/lib/signingKeys.js`
  (overridable by the CLI via `--keys <file>`).
- Python: `/app/config/signing_keys.json` (overridable via env
  `AURA_SIGNING_KEYS`).

## Key registry entry

```json
{
  "key_id": "aura-key-2026Q1-demo-001",
  "algorithm": "ed25519",
  "public_key_hex": "<64 hex chars, 32 raw bytes>",
  "status": "active" | "retired" | "revoked",
  "valid_from": "<RFC 3339 UTC>",
  "valid_until": "<RFC 3339 UTC>",
  "note": "human-readable"
}
```

## Lifecycle rules (verifier)

Given `attestation.key_id`, `attestation.signed_at`, and the trusted registry:

1. Look up `key_id` in the registry.
   - If not found → FAIL (`unknown_key`).
2. If `entry.status === "revoked"` → FAIL (`revoked_key`). Revocation is
   **retroactive** in v1: it invalidates all prior signatures made with the
   key. This is the conservative default; a future spec version MAY split
   revocation from retirement.
3. If `entry.status === "retired"` and `signed_at > entry.valid_until` →
   FAIL (`signed_after_retirement`). Signatures inside the window still verify.
4. If `signed_at < entry.valid_from` OR `signed_at > entry.valid_until` →
   FAIL (`out_of_window`).
5. Recompute the expected canonical payload from the bundle contents (see
   above) and compare byte-for-byte with `attestation.signed_payload`. If
   they differ → FAIL (`payload_mismatch`) — this catches every kind of
   session tampering.
6. Ed25519-verify `signature` over UTF-8(`signed_payload`) using
   `entry.public_key_hex`. If verification fails → FAIL (`bad_signature`).
7. All checks pass → PASS.

## Reporting semantics

- **No `attestation` block in bundle** → status `NOT APPLICABLE` with reason
  `"No attestation block present; nothing to verify."` The suite is allowed
  to overall-PASS on unattested bundles. Third parties MAY require
  attestation as a policy layer above the Conformance Core.
- **Any FAIL reason above** → status `FAIL` with a concrete failure code.
- **All checks succeed** → status `PASS` with the recognized key id + signed_at
  in the message.

## Reference verifier equivalence

The pure-Python Ed25519 verifier (`/app/py_verifier/ed25519_ref.py`) MUST
produce identical PASS/FAIL results as Node's built-in `crypto.verify()` and
the browser's `SubtleCrypto.verify({name:"Ed25519"})` for every bundle in the
attestation parametric test matrix
(`/app/py_verifier/tests/test_attestation.py`), including tampered payloads,
bad signatures, unknown keys, and revoked keys.

## Enforcement / tests

- `/app/frontend/tests/attestation.test.mjs` — positive + all 6 negative
  scenarios (payload mismatch, bad sig, unknown key, revoked key, out-of-window,
  no attestation).
- `/app/py_verifier/tests/test_attestation.py` — same negatives plus
  Python/Node signer/verifier cross-agreement on the demo signed bundle.
- The Conformance Core `impl:attestation-signature` test replaces the prior
  static NOT IMPLEMENTED with runtime PASS / FAIL / NOT APPLICABLE per the
  rules above.

## Security notes (demo)

The demo key pair committed in `/app/cli/demo-keys.mjs` and
`/app/config/signing_keys.json` is **for demonstration only** and MUST NOT
be used to sign real evidence. Production deployments MUST replace both
files with a rotated key managed under an HSM or equivalent key custody
regime and MUST NOT commit private keys to source control.
