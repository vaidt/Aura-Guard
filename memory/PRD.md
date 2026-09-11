# Aura-Guard — PRD (Phase 3.3 · INV-XIM-01 Live Cross-Impl)

## Original problem statement
Aura-Guard Compliance Auditor: a demonstrator that shows how organizations can audit AI decisions and verify integrity of audit evidence. Dashboard, JSON import, audit view, evidence verification, tamper demonstration, printable report. Deterministic, no ML, no external AI.

## Modernization Mission (2026-02)
Transform the demonstrator into a **Conformance & Evidence Console** for the Aura protocol architecture. Keep protocol semantics OUT of the presentation layer. Never treat stored cryptographic fields as trustworthy — verifier must independently re-derive.

## Phase evolution
- **Phase 1**: Conformance Core wraps read-only verifier; UI never redefines semantics.
- **Phase 2**: Node CLI + Python stdlib reference verifier + cross-impl matrix (out-of-band).
- **Phase 3**: Binding Matrix v1.0 — every check wired to a matrix row.
- **Phase 3.1**: `INV-FLT-01` — ES-NumberToString bit-exact numeric canonicalization.
- **Phase 3.2**: `INV-ATT-01` — Ed25519 attestation, canonical payload, key lifecycle, pure-Python Ed25519 reference verifier.
- **Phase 3.3 (done, 2026-02-02)**: `INV-XIM-01` — **live** cross-impl runtime agreement.

## Phase 3.3 — What was implemented
- **Node CLI** (`/app/cli/aura-verify.mjs`, rewritten): by default spawns `python3 /app/py_verifier/aura_verify.py <bundle> --json`, parses its suite, compares per-test status across the two verifiers (excluding `impl:cross-implementation` itself), and threads the result into the Conformance Core via a new optional `crossImplResult` parameter. Flags: `--no-cross-impl`, `--py <bin>`, `--py-script <path>`; env `AURA_PY_BIN`, `AURA_PY_VERIFIER`.
- **Conformance Core**: `checkCrossImplementation(crossImplResult)` now emits:
  - `PASS` (live) — two verifiers agreed on every common check id.
  - `FAIL` — mismatch with details (`id`, `node`, `other`).
  - `NOT APPLICABLE` — browser runtime, `--no-cross-impl`, or Python unavailable (with concrete reason).
- **Binding matrix**: `INV-XIM-01` moved from `NOT_IMPLEMENTED_AT_RUNTIME` → `IMPLEMENTED`. Matrix bumped to `v1.3`. All 10 rows now `IMPLEMENTED`.
- **Tests**:
  - New `/app/frontend/tests/crossImpl.test.mjs` (5 cases): clean → PASS, `--no-cross-impl` → NOT_APPLICABLE, missing python bin → NOT_APPLICABLE with reason, missing script → NOT_APPLICABLE, tampered bundle → agreement holds on FAIL.
  - `conformance.test.mjs` and `portability.test.mjs` updated (NOT_IMPLEMENTED → NOT_APPLICABLE where appropriate; CLI/UI agreement test now uses `--no-cross-impl`).
  - `test_cross_impl.py` updated: `_agree` excludes `impl:cross-implementation` (inherently local per verifier); Node CLI invoked with `--no-cross-impl` inside the Python-driven matrix.
- **Compatibility**: browser Conformance page still shows `NOT APPLICABLE` for INV-XIM-01 — honest reporting, no false PASS.

## Test status (2026-02-02)
- **Node: 61/61 PASS** (+5 new INV-XIM-01 tests). 
- **Python: 39/39 PASS** (updated `_agree` + CLI invocation for cross-impl exclusion).
- CLI smoke: clean sample → overall PASS with `impl:cross-implementation = PASS` (live agreement with `aura-verify-py/0.3.0`).

## Known limitations (honestly reported)
- Browser runtime cannot spawn Python → `INV-XIM-01` reports `NOT_APPLICABLE` in the UI. This is honest.
- `PROTOCOL_VERSION="unspecified"` — no normative Aura spec supplied.
- Session state is in-memory only; no authentication.
- Demo signing key committed to source control — flagged DEMO ONLY.

## Roadmap / next tasks
- **P1**: Failure attribution panel on Report — surface `code` + specific record for every FAIL, including attestation and cross-impl mismatches.
- **P1**: In-UI "Attest session" action button + Attestation status card.
- **P2**: Third reference verifier (Go or Rust stdlib) to bring the N-way agreement matrix to 3 implementations.
- **P2**: Multi-key rotation demo bundle set.
- **P3**: Optional ChatGPT integration (isolated module outside Conformance Core boundary) — pending user re-confirmation.

## Canonical demonstration flow (tested)
Load sample → auto-attested with demo key → Conformance shows **10 tests**, INV-ATT-01 PASS, INV-XIM-01 NOT APPLICABLE (browser) → Export bundle → `node /app/cli/aura-verify.mjs bundle.json` → default flow spawns Python → **INV-XIM-01 = PASS** with `Live agreement: ... aura-verify-py/0.3.0` → Tamper → both verifiers report identical FAILures → agreement holds → INV-XIM-01 still PASS while overall FAILs.
