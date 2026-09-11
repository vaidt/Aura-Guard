# Aura-Guard — PRD (Phase 3.1 · INV-FLT-01 Numeric Canonicalization)

## Original problem statement
Aura-Guard Compliance Auditor: a demonstrator that shows how organizations can audit AI decisions and verify integrity of audit evidence. Dashboard, JSON import, audit view, evidence verification, tamper demonstration, printable report. Deterministic, no ML, no external AI.

## Modernization Mission (2026-02)
Transform the demonstrator into a **Conformance & Evidence Console** for the Aura protocol architecture. Keep protocol semantics OUT of the presentation layer. Never treat stored cryptographic fields as trustworthy — verifier must independently re-derive.

## AS-IS → TO-BE architecture
- **Phase 1 (done):** UI → **Conformance Core** (`lib/conformanceCore.js`) → `lib/verification.js`.
- **Phase 2 (done):** Node CLI + Python stdlib reference verifier + cross-implementation test matrix.
- **Phase 3 (done, 2026-02-02):** Protocol → Implementation Binding Matrix v1.0. Every check wired to a matrix invariant + requirement set.
- **Phase 3.1 (done, 2026-02-02):** `INV-FLT-01` — bit-exact numeric canonicalization locked to ECMAScript `Number::toString`. Declared gap closed.

## Phase 3.1 — What was implemented
- **INV-FLT-01 spec doc**: `/app/docs/INV_FLT_01_NUMERIC_CANONICALIZATION.md` — normative rule (ES §6.1.6.1.13), reference vectors, non-finite rejection.
- **JS canonicalizer**: `/app/frontend/src/lib/canonicalNumber.js` exports `canonicalNumberString(n)` (thin `String(n)` after finite-value gate) and `CANONICAL_NUMBER_VECTORS`. `verification.js` `canonicalize()` now rejects `NaN`/`±Infinity` and routes numbers through the pinned rule.
- **Python canonicalizer**: `/app/py_verifier/aura_verify.py` now has `_js_number_to_string()` — pure port of ES-NumberToString via Python's shortest round-trip `repr`. Fixes the `640.0`/`1.0` fragility.
- **Conformance Core**: `checkNumericCanonicalization()` added as a fixture probe; emits `impl:numeric-canonicalization` wired to `INV-FLT-01` / `REQ-FLT-01`.
- **Binding matrix**: `INV-FLT-01` moved from declared gap → `IMPLEMENTED`. `matrix_version` bumped to `1.1`.
- **Tests**: `/app/frontend/tests/numericCanonicalization.test.mjs` (6 new) + `/app/py_verifier/tests/test_numeric_canonicalization.py` (18 new, incl. JS↔Python subprocess parity for every vector).

## Test status (2026-02-02)
- Node: **45/45 PASS** (was 39; +6 numeric-canonicalization).
- Python: **29/29 PASS** (was 11; +14 parameterized fixture + +4 negative/collapse/JS-parity).
- CLI portability + cross-impl matrix: unchanged, all still green.

## Known limitations / NOT IMPLEMENTED (honestly reported)
- `INV-XIM-01` / `impl:cross-implementation` — cross-impl agreement is a repo-level property, not a runtime property of a single verifier.
- `INV-ATT-01` / `impl:attestation-signature` — no normative signature specification supplied.
- `PROTOCOL_VERSION="unspecified"` — no normative Aura specification document supplied.
- Session state is in-memory only. No authentication.

## Roadmap / next tasks
- **P1**: WP-4 — attestation signature scheme (canonical payload, algorithm, key lifecycle) for `INV-ATT-01`.
- **P2**: Live cross-implementation runtime check (spawn Python verifier from Node CLI, compare per-test) to flip `INV-XIM-01`.
- **P2**: Bundle diff / attribution panel — which record broke which invariant, at a glance from the Report page.
- **P3**: Optional ChatGPT integration (isolated module outside Conformance Core boundary) — pending user re-confirmation.

## Canonical demonstration flow (tested)
Load sample → Dashboard (10 decisions, PASS) → Verification (10/10 all checks) → Conformance (PASS · 10 tests · INV-FLT-01 among them · 2 NOT IMPLEMENTED remain) → Tamper Demo → cascade FAIL → Reset → PASS → Report → Export bundle → `node /app/cli/aura-verify.mjs bundle.json` → PASS · `python3 /app/py_verifier/aura_verify.py bundle.json` → PASS.
