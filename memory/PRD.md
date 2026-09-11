# Aura-Guard — PRD (Phase 3 · Architecture Pack)

## Original problem statement
Aura-Guard Compliance Auditor: a demonstrator that shows how organizations can audit AI decisions and verify integrity of audit evidence. Dashboard, JSON import, audit view, evidence verification, tamper demonstration, printable report. Deterministic, no ML, no external AI.

## Modernization Mission (2026-02)
Transform the demonstrator into a **Conformance & Evidence Console** for the Aura protocol architecture. Keep protocol semantics OUT of the presentation layer. Never treat stored cryptographic fields as trustworthy — verifier must independently re-derive.

## Phase evolution
- Phase 1: Conformance Core wraps read-only verifier.
- Phase 2: Node CLI + Python stdlib reference verifier + cross-impl matrix (out-of-band).
- Phase 3.0–3.3: Binding Matrix v1.3 wires every check to a matrix row (`INV-FLT-01` numeric, `INV-ATT-01` Ed25519 attestation, `INV-XIM-01` live cross-impl agreement).
- **Phase 2.5 (done, 2026-02-02)**: Code-quality hardening. **Behavior-preserving.** No semantic change to any verification / conformance / attestation / cross-impl invariant.

## Phase 2.5 — What was done
- **Gate 1 — Behavior lock**: added `/app/frontend/tests/goldenVectors.test.mjs` (4 tests) freezing the exact SHA-256 primitive output, `canonicalize()` output, first-record evidence structure of `SAMPLE_SESSION`, and the exact 10-check emit order + status distribution. Any future refactor that drifts semantics fails these tests immediately.
- **Gate 2 — React hook deps**: `/app/frontend/src/hooks/use-toast.js` — corrected `useEffect(..., [state])` to `useEffect(..., [])`. Real bug (listener was re-installed on every toast state change); no observable behaviour change but hook now conforms to react-hot-toast reference pattern.
- **Gate 5 — Nested ternaries**: `/app/frontend/src/pages/Dashboard.jsx` — extracted 3 helper functions (`integrityTone`, `integrityDetail`, `statusTone`) replacing nested ternaries in the integrity card + ledger row. Identical output for every input.
- **Gate 6 — Console statements**: added `/app/frontend/src/lib/logger.js` — minimal opt-in logger (silent unless `globalThis.AURA_DEBUG === true`). Replaced 2 `console.*` in `AuditContext.jsx` with `log.*`. Error handling preserved.
- **Gate 7 — Type coverage**: added Python type hints to `server.py` (`root`, `health`, `shutdown_db_client`).
- **Gate 8 — Boundary audit**: UI still does not compute canonical/chain hashes. `TamperDemo` still reads `verification.results` produced by `verifySession()`. CLI still routes through `runConformanceSuite`. Python verifier remains stdlib-only + independent.
- **Gate 10 — No semantic drift**: `PROTOCOL_VERSION="unspecified"`, `BUNDLE_VERSION=1`, `VERIFIER_VERSION="aura-guard-conformance-core/0.3.0"`, `BINDING_MATRIX_VERSION="1.3"`, INV-XIM-01 / INV-ATT-01 / tamper-detection semantics all unchanged.

## Test status (2026-02-02)
- **Node: 65/65 PASS** (+4 golden vectors vs. prior 61).
- **Python: 39/39 PASS** (unchanged).
- **Live CLI on demo bundle**: overall PASS with all 10 checks PASS (incl. INV-XIM-01 live agreement with `aura-verify-py/0.3.0` and INV-ATT-01 via demo Ed25519 key).

## Explicit confirmation
**Phase 2 verification semantics were preserved.**

## Known limitations (unchanged)
- Browser cannot spawn Python → INV-XIM-01 reports `NOT APPLICABLE` in the UI (honest).
- Demo signing key committed to source — DEMO ONLY.
- Session state is in-memory only; no authentication.

## Phase 3 — Architecture Pack (done, 2026-02-02, analysis only, no code changes)
- Delivered six documentation-only artifacts under `/app/docs/`:
  - `PHASE_3_SEMANTIC_INVENTORY.md` — 16 files inspected, semantic surfaces enumerated with FACT / TESTED / ASSUMPTION / AMBIGUITY tags.
  - `PHASE_3_PROTOCOL_DECISION_MATRIX.md` — 12 canonical Owner decisions P-001 … P-012 (question → options → RECOMMENDATION ONLY → OWNER DECISION REQUIRED).
  - `PHASE_3_AMBIGUITY_REGISTER.md` — 23 rows (16 canonical A-001…A-016 + 7 discovered A-101…A-107).
  - `PHASE_3_GOLDEN_VECTOR_PLAN.md` — golden-vector categories, coverage gaps, BLOCKED BY DECISION P-XXX markers.
  - `PHASE_3_PROTOCOL_INVARIANT_CANDIDATES.md` — 30 candidate `AURA-INV-*` invariants across 15 categories.
  - `PHASE_3_ARCHITECTURE_PACK.md` — final combined report with sequencing recommendations.
- Discovered additional candidate domains (NOT promoted into canonical catalogue): P-013 attestation governance, P-014 replay/idempotency, P-015 policy comparator, P-016 cascade source, P-017 envelope openness.
- Confirmed no production code was changed (verified via `git status --short`: only `docs/PHASE_3_*.md` files added).
- Cross-file consistency check flagged one drift: `BINDING_MATRIX_VERSION` = `1.3` in JS vs `1.2` hard-coded in `aura_verify.py` (recorded as A-012, blocked by P-009).

## Roadmap / next tasks
- **P0 (Owner)**: Rule on P-001 … P-012 to unblock `protocol_version` transition out of `"unspecified"`.
- **P0 (Owner)**: Elect whether to promote P-013 … P-017 into the normative catalogue.
- **P1 (post-decision)**: Backfill golden vectors currently marked BLOCKED BY DECISION P-XXX.
- **P1 (post-decision)**: Sync `BINDING_MATRIX_VERSION` between JS (`1.3`) and Python (`1.2`).
- **P1**: Failure attribution panel on Report (which record + which invariant, incl. attestation code).
- **P1**: In-UI "Attest session" action button + Attestation status card on Dashboard.
- **P2**: Third reference verifier (Go/Rust stdlib) → N-way agreement matrix.
- P2: Multi-key rotation demo bundle set.
