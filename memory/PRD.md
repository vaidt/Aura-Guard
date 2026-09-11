# Aura-Guard — PRD (Phase 3 Binding Matrix)

## Original problem statement
Aura-Guard Compliance Auditor: a demonstrator that shows how organizations can audit AI decisions and verify integrity of audit evidence. Dashboard, JSON import, audit view, evidence verification, tamper demonstration, printable report. Deterministic, no ML, no external AI.

## Modernization Mission (2026-02)
Transform the demonstrator into a **Conformance & Evidence Console** for the Aura protocol architecture. Keep protocol semantics OUT of the presentation layer. Never treat stored cryptographic fields as trustworthy — verifier must independently re-derive.

## AS-IS → TO-BE architecture
- **Phase 1 (done):** UI → **Conformance Core** (`lib/conformanceCore.js`) → `lib/verification.js`. UI renders structured suite results; never recomputes.
- **Phase 2 (done):** Node CLI (`/app/cli/aura-verify.mjs`) + Python stdlib reference verifier (`/app/py_verifier/aura_verify.py`) + cross-implementation test matrix.
- **Phase 3 (done, 2026-02):** Protocol → Implementation Binding Matrix v1.0. Every Conformance Core test is wired to a matrix invariant + requirement set. Declared gaps enumerated to prevent silent PASS.

## Phase 3 — What was implemented (2026-02-02)
- **Binding Matrix docs**
  - `/app/docs/BINDING_MATRIX.md` — normative-shaped binding of requirements (`REQ-*-*`) → invariants (`INV-*-*`) → executable checks (`impl:*`) → check functions.
  - `/app/docs/binding_matrix.json` — machine-readable authoritative form (10 rows, incl. one declared gap `INV-FLT-01`).
- **Conformance Core refactor** (`/app/frontend/src/lib/conformanceCore.js` → `verifier_version=0.3.0`, adds `binding_matrix_version=1.0`)
  - One invariant → one check function: `checkEvidenceStructure`, `checkCanonicalRepresentation`, `checkSha256Integrity`, `checkChainContinuity`, `checkPolicyBinding`, `checkTamperDetection`, `checkEvidencePortability`, `checkCrossImplementation`, `checkAttestationSignature`.
  - Every emitted test carries `invariant_id` + `requirement_ids` from the matrix.
- **Matrix loader** (`/app/frontend/src/lib/bindingMatrix.js`) — code-side mirror of `binding_matrix.json`, validated for byte identity by tests.
- **Matrix consistency tests** (`/app/frontend/tests/bindingMatrix.test.mjs`, 7 new tests): asserts code↔JSON row identity, every IMPLEMENTED row exports its check function, every emitted test has matrix wiring, no duplicate ids, declared gaps never emitted, NOT_IMPLEMENTED rows honestly reported.
- **Conformance UI** (`/app/frontend/src/pages/Conformance.jsx`) — new `Invariant` + `Requirements` columns, `binding_matrix_version` in the meta strip, `data-testid`s: `conformance-invariant-{id}`, `conformance-requirements-{id}`.

## Test status (2026-02-02)
- Node: **39/39 PASS** across `verification.test.mjs`, `conformance.test.mjs`, `portability.test.mjs`, `schema.test.mjs`, `tamperProbe.test.mjs`, `bindingMatrix.test.mjs`.
- Python: **11/11 PASS** cross-implementation matrix in `/app/py_verifier/tests/test_cross_impl.py`.
- CLI portability: positive + negative parametric mutations all agree between Node and Python.

## Known limitations / NOT IMPLEMENTED (honestly reported)
- `INV-XIM-01` / `impl:cross-implementation` — cross-implementation agreement is a repository property established by out-of-band test matrix, not a runtime property of a single verifier invocation.
- `INV-ATT-01` / `impl:attestation-signature` — no normative signature specification supplied.
- `INV-FLT-01` — declared canonicalization gap; floating-point numeric canonicalization is not spec'd; enumerated so it cannot be silently claimed PASS.
- `PROTOCOL_VERSION="unspecified"` — no normative Aura specification document supplied.
- Session state is in-memory only. No authentication.

## Roadmap / next tasks
- **P1**: WP-3 — normative floating-point canonicalization spec + check for `INV-FLT-01`.
- **P1**: WP-4 — attestation signature scheme (canonical payload for signing, algorithm, key lifecycle, encoding) for `INV-ATT-01`.
- **P2**: Live cross-implementation runtime check (spawn Python verifier from Node CLI, compare per-test).
- **P2**: Bundle diff/attribution view (which record broke which invariant).
- **P3**: Optional ChatGPT integration (isolated module, outside Conformance Core boundary) — pending user re-confirmation.

## Canonical demonstration flow (tested)
Load sample → Dashboard (10 decisions, all PASS) → Verification (10/10 all checks) → Conformance (overall PASS, invariant_id + requirement_ids visible, 2 NOT IMPLEMENTED, 1 declared gap in matrix) → Audit → Open a decision → Tamper Demo → cascade FAIL → Reset → PASS → Report → Export bundle → `node /app/cli/aura-verify.mjs bundle.json` → PASS.
