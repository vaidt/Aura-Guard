# Aura-Guard — PRD (Phase 3.2 · INV-ATT-01 Attestation Signature)

## Original problem statement
Aura-Guard Compliance Auditor: a demonstrator that shows how organizations can audit AI decisions and verify integrity of audit evidence. Dashboard, JSON import, audit view, evidence verification, tamper demonstration, printable report. Deterministic, no ML, no external AI.

## Modernization Mission (2026-02)
Transform the demonstrator into a **Conformance & Evidence Console** for the Aura protocol architecture. Keep protocol semantics OUT of the presentation layer. Never treat stored cryptographic fields as trustworthy — verifier must independently re-derive.

## AS-IS → TO-BE architecture
- **Phase 1 (done):** UI → **Conformance Core** → `verification.js`.
- **Phase 2 (done):** Node CLI + Python stdlib reference verifier + cross-impl matrix.
- **Phase 3 (done):** Binding Matrix v1.2 wires every check to a matrix row.
- **Phase 3.1 (done):** `INV-FLT-01` — ES-NumberToString bit-exact numeric canonicalization.
- **Phase 3.2 (done, 2026-02-02):** `INV-ATT-01` — Ed25519 attestation with out-of-band key registry, key lifecycle, and pure-Python reference verifier.

## Phase 3.2 — What was implemented
- **Spec doc**: `/app/docs/INV_ATT_01_ATTESTATION_SIGNATURE.md` — algorithm (Ed25519, RFC 8032), canonical signed payload (binds to re-derived final chain hash), wire format, key lifecycle (active/retired/revoked, validity window), reporting semantics.
- **JS attestation module**: `/app/frontend/src/lib/attestation.js` — `signAttestation`, `verifyAttestation` (self-re-deriving), `buildAttestationPayload`, `ed25519VerifyHex`, WebCrypto-based sign/verify (works in Node ≥20 webcrypto + modern browsers Chrome/Safari/Firefox).
- **Trusted registry**: `/app/config/signing_keys.json` + JS mirror `/app/frontend/src/lib/signingKeys.js` (validated byte-equal by tests). Ships one active demo key and one revoked demo key for negative testing.
- **Node signer CLI**: `/app/cli/aura-sign.mjs` — attaches an attestation block to any bundle. `aura-verify.mjs` now threads `attestation` through the suite.
- **Pure-Python Ed25519 verifier**: `/app/py_verifier/ed25519_ref.py` (~90 lines, RFC 8032 Appendix A port) — keeps the Python reference verifier stdlib-only. Cross-checked bit-for-bit against Node's built-in Ed25519.
- **Conformance Core**: `checkAttestationSignature` replaced with real impl. Returns `NOT APPLICABLE` when no attestation, `PASS`/`FAIL` when present, with a concrete failure `code`.
- **AuditContext**: auto-attests the built-in sample bundle on load (via WebCrypto Ed25519 sign) so the demo showcases the PASS path out-of-the-box. Imported bundles keep their own attestation.
- **Report page**: attestation section rewritten to reflect implemented state.
- **Binding matrix**: `INV-ATT-01` moved from `NOT_IMPLEMENTED` → `IMPLEMENTED`. Matrix bumped to `v1.2`.

## Test status (2026-02-02)
- **Node: 56/56 PASS** (was 45; +11 attestation covering positive, tamper cascade, bad-sig, unknown-key, revoked-key, out-of-window, unsupported-algorithm, malformed, no-attestation NOT_APPLICABLE, registry mirror parity).
- **Python: 39/39 PASS** (was 29; +10 including Node↔Python signer/verifier parity, revoked-key rejection, pure-Python Ed25519 bit-exact vs Node).
- CLI portability + cross-impl matrix + numeric canonicalization: unchanged, all green.

## Known limitations (honestly reported)
- `INV-XIM-01` / `impl:cross-implementation` — remains `NOT_IMPLEMENTED_AT_RUNTIME`. Agreement is established by the parametric test matrix, not by a single verifier invocation.
- `PROTOCOL_VERSION="unspecified"` — no normative Aura specification document supplied.
- Session state is in-memory only. No authentication.
- Demo signing key is committed to source control — flagged as DEMO ONLY. Production requires HSM/KMS-managed key custody.

## Roadmap / next tasks
- **P1**: Runtime cross-implementation check — spawn Python verifier from Node CLI, compare per-test → flip `INV-XIM-01` to live PASS.
- **P1**: In-UI "Attest session" action button + attestation status card on Dashboard/Report.
- **P2**: Bundle diff / attribution panel — which record broke which invariant, one glance from Report.
- **P2**: Multi-key registry demo (rotation, retirement scenarios).
- **P3**: Optional ChatGPT integration (isolated module outside Conformance Core boundary) — pending user re-confirmation.

## Canonical demonstration flow (tested)
Load sample → **auto-attested with demo key** → Conformance (10 tests, INV-ATT-01 PASS, INV-XIM-01 NOT IMPLEMENTED) → Tamper Demo → cascade FAIL on INV-CAN-01, INV-HASH-01, INV-CHN-01 **AND** INV-ATT-01 (payload_mismatch) → Reset → PASS → Report → Export bundle → `node /app/cli/aura-sign.mjs bundle.json` → `node /app/cli/aura-verify.mjs bundle.json` → PASS · `python3 /app/py_verifier/aura_verify.py bundle.json` → PASS.
