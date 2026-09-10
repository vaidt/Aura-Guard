# Aura-Guard — PRD (Phase 1 Modernization)

## Original problem statement
Aura-Guard Compliance Auditor: a demonstrator that shows how organizations can audit AI decisions and verify integrity of audit evidence. Dashboard, JSON import, audit view, evidence verification, tamper demonstration, printable report. Deterministic, no ML, no external AI.

## Modernization Mission (2026-02, Phase 1)
Transform the demonstrator into a **Conformance & Evidence Console** for the Aura protocol architecture. Keep protocol semantics OUT of the presentation layer. Never treat stored cryptographic fields as trustworthy — verifier must independently re-derive.

## AS-IS → TO-BE architecture
- **AS-IS:** UI → Context → `lib/verification.js` (pure). Verification results consumed by pages. Evidence bundle export exists.
- **TO-BE:** UI → **Conformance Core** (`lib/conformanceCore.js`) → `lib/verification.js`. UI renders structured suite results; never recomputes.

## What was implemented in this phase
- **Conformance Core** (`/app/frontend/src/lib/conformanceCore.js`): `runConformanceSuite()` returns machine-readable `{ protocol_version, verifier_version, bundle_version, run_at, record_count, overall, tests[] }`. Test IDs prefixed `impl:` (non-normative). Constants: `PROTOCOL_VERSION="unspecified"`, `VERIFIER_VERSION="aura-guard-conformance-core/0.2.0"`.
- **Conformance page** (`/conformance`): overall badge, per-test table, and raw JSON output. Reports NOT IMPLEMENTED for evidence-portability, cross-implementation, attestation-signature.
- **TamperDemo**: stored vs re-derived hashes shown side-by-side in a 4-cell panel with visual pass/fail colouring.
- **HashDisplay** component with clipboard copy (used-ready).
- **Report**: cites `protocol_version`, `verifier_version`, `bundle_version`, "Report source: Evidence → Conformance Core → Report"; attestation section explicitly names NOT IMPLEMENTED areas.
- **Verification core bug fix** (prior turn): `verifySession` now uses **re-derived** previous chain hash as `prev` so tamper cascades correctly.
- **Regression tests**: `frontend/tests/verification.test.mjs` (11 tests) + `frontend/tests/conformance.test.mjs` (9 negative tests: reason mutation, policy_version mutation, canonical_hash mutation, prev_hash mutation, chain_hash mutation, id removal, record reordering, empty bundle).

## What was NOT changed
- `lib/verification.js` canonicalization (RFC-8785-flavoured JCS-lite) and SHA-256 primitives.
- Sample dataset schema.
- Dashboard, Audit, Report page layouts (only added meta).
- Backend surface (health only).
- No MongoDB persistence.

## Known limitations / NOT IMPLEMENTED
- `impl:evidence-portability` — no independent verifier CLI in another environment.
- `impl:cross-implementation` — only one reference implementation exists.
- `impl:attestation-signature` — no cryptographic signature spec supplied.
- `PROTOCOL_VERSION="unspecified"` — no normative Aura specification document supplied to this project.
- Session state is in-memory only.
- No authentication (open access per user preference).

## Canonical demonstration flow (tested)
Load sample → Dashboard (10 decisions, all PASS) → Verification (10/10 all checks) → Conformance (overall PASS, 3 NOT IMPLEMENTED) → Audit → Open a decision (inspect canonical/prev/chain hash + policy) → Tamper Demo (select DEC-0003, change `reason`, Apply) → Verification cascades FAIL through downstream records → Reset → PASS → Report → Export bundle / Print PDF.

## Assumptions / TODOs
- ASSUMPTION: RFC-8785-flavoured JCS-lite is an acceptable stand-in until a normative canonicalization scheme is defined.
- TODO: standalone verifier CLI that re-verifies an exported bundle → enables `impl:evidence-portability` to move from NOT IMPLEMENTED to PASS.
- TODO: attestation-signature spec (canonical payload for signing, algorithm, key lifecycle, encoding).
