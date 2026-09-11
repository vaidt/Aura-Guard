# PHASE 3 — ARCHITECTURE PACK (Final Combined Report)

**Status:** ANALYSIS ARTIFACT · NON-NORMATIVE · READ-ONLY
**protocol_version:** `unspecified`
**Owner:** Aura Protocol Owner (recipient of this pack).
**Producer:** Phase-3 architecture analysis pass — no production code
was written, modified, refactored, or deleted.

This document is the **final consolidated deliverable** of the Phase-3
Architecture Pack directive. It composes and cross-references the five
companion analysis artifacts:

1. [`PHASE_3_SEMANTIC_INVENTORY.md`](./PHASE_3_SEMANTIC_INVENTORY.md)
2. [`PHASE_3_PROTOCOL_DECISION_MATRIX.md`](./PHASE_3_PROTOCOL_DECISION_MATRIX.md)
3. [`PHASE_3_AMBIGUITY_REGISTER.md`](./PHASE_3_AMBIGUITY_REGISTER.md)
4. [`PHASE_3_GOLDEN_VECTOR_PLAN.md`](./PHASE_3_GOLDEN_VECTOR_PLAN.md)
5. [`PHASE_3_PROTOCOL_INVARIANT_CANDIDATES.md`](./PHASE_3_PROTOCOL_INVARIANT_CANDIDATES.md)

**Execution constraints honored** — as re-stated by the Owner at
kickoff:

- No production code was touched.
- Canonical P-001 … P-012 decision catalogue is preserved.
- Newly discovered domains are recorded as `DISCOVERED / P-013+` in the
  Ambiguity Register only; they have **not** been promoted into the
  canonical catalogue.
- Every finding is strictly labeled: FACT / TESTED / ASSUMPTION /
  AMBIGUITY / INV-CANDIDATE / OPTION / RECOMMENDATION / OWNER-DECISION.
- No ambiguity has been resolved. Any recommendation is
  **RECOMMENDATION ONLY**.
- No golden-vector expected values were fabricated for
  unresolved semantics — those rows are marked **BLOCKED BY DECISION
  P-XXX**.
- Attestation / signing semantics remain **DEFERRED / NON-NORMATIVE**.

---

## 1. Executive summary

Aura-Guard is presently a **highly-tested, dual-implementation
demonstrator** whose invariants are declared **implementation-scoped**
(`REQ-*` / `INV-*` / `protocol_version = "unspecified"`). Two verifiers
(Node ESM + pure-Python stdlib) agree at runtime on 10 semantic checks
spanning canonicalization, integrity, chain linkage, policy binding,
tamper detection, portability, cross-implementation parity, and Ed25519
attestation.

The Phase-3 analysis identifies **23 explicit ambiguities** — 16 tied to
the canonical decision catalogue (P-001 … P-012) and 7 tied to
newly-discovered candidate domains (`P-013+`). It also identifies **30
candidate architectural invariants** across 15 categories. **12 of these
candidates are already "ready to normalize"** given only editorial spec
language; **18 depend on Owner decisions** listed in the Decision Matrix.

**No decision has been made in this pack.** The Aura Protocol cannot
transition out of `"unspecified"` until the Owner rules on at least
P-001 … P-012.

## 2. Contents summary

| Document | Purpose | Size |
|---|---|---|
| Semantic Inventory | Enumerates every semantic surface the two verifiers currently depend on, with FACT / TESTED / ASSUMPTION / AMBIGUITY tags per row. | ~ 3 pages of tables. |
| Decision Matrix | The 12 canonical Owner decisions (P-001 … P-012): question → facts → enumerated options → recommendation → **OWNER DECISION REQUIRED**. | 12 sections. |
| Ambiguity Register | 23 specific ambiguity rows (A-001 … A-016 canonical + A-101 … A-107 discovered) linked to the decisions that unblock each. | 2 sections. |
| Golden Vector Plan | Categories & shapes of golden vectors needed for a normative freeze, with **BLOCKED BY DECISION P-XXX** markers for values that cannot yet be fabricated. | 10 categories. |
| Invariant Candidates | 30 proposed `AURA-INV-*-<n>` architectural invariants with binding-decision references. | 15 categories. |

## 3. Canonical decision surface (P-001 … P-012)

The 12 canonical Owner decisions inferred from the current codebase and
enumerated in the Decision Matrix:

| ID | Domain | Owner question |
|---|---|---|
| **P-001** | Canonicalization algorithm identity | Which spec? JCS-lite (current), RFC 8785, or a stricter subset? |
| **P-002** | Numeric serialization | Retain ES-NumberToString? Integer domain? Bignum? Subnormals? |
| **P-003** | Hash function | Pin SHA-256 forever, or carry a `hash_algorithm` field? |
| **P-004** | Hash-chain linkage formula | Textual hex concatenation (current) vs raw-byte vs domain-separated? |
| **P-005** | Genesis anchor | 64×`0x30` (current) vs SHA-256("") vs session-derived? |
| **P-006** | Timestamp grammar & zone | RFC 3339 UTC strict? RFC 3339 any offset? Unix ms? |
| **P-007** | String / character encoding & escape rules | Pin RFC 8785 §3.2.2, JS `JSON.stringify`, or Python `json.dumps(ensure_ascii=False)`? |
| **P-008** | Verifier error / failure codes | Codes advisory, normative, or two-tier? |
| **P-009** | Binding-matrix governance | Matrix normative or implementation-scoped? Version drift rule? |
| **P-010** | Verifier CLI contract & JSON schema | Publish a JSON Schema for `--json` output? |
| **P-011** | Cross-implementation parity protocol | Symmetric spawn vs reference-implementation vs golden-corpus? |
| **P-012** | Envelope & version compatibility | SemVer or integer? Unknown-key policy? Attestation required? |

Full text, enumerated options, and recommendations are in the Decision
Matrix.

## 4. Discovered additional domains (candidate P-013+)

These were surfaced during code inspection. They are **not** part of
P-001 … P-012 and MUST NOT be silently promoted. The Owner may elect to
promote them in a subsequent phase.

| Candidate ID | Domain | Blocking question |
|---|---|---|
| **P-013** | Attestation governance | Is Ed25519 attestation part of Aura Protocol at all? What is the multi-signer / counter-signature model? Is `retired` a live status? |
| **P-014** | Verifier replay / idempotency | Must verify be a pure function? |
| **P-015** | Policy-version semantics | Comparator: identity, semver, content-hash? |
| **P-016** | Cascade / prev-hash source | Re-derived (current) vs stored? |
| **P-017** | Envelope openness | Extra keys: tolerate / forbid / `x-`-prefixed? |

## 5. Cross-cutting risk map

Each risk lists the decision(s) that would remove it.

| Risk | Failure mode | Removes with |
|---|---|---|
| Unicode-key canonicalization drift between JS and Python. | Silent hash divergence on non-ASCII payloads. | P-001, P-007. |
| Numeric drift on subnormals / integer edge / bignum. | Silent evidence corruption. | P-002. |
| Textual-vs-binary hash-chain concatenation misread by a 3rd-party impl. | Total chain-hash divergence. | P-004. |
| Attestation timestamp form drift. | Attestation verified by one impl rejected by another. | P-006. |
| Free-form failure codes. | Automated remediation impossible across impls. | P-008. |
| Binding-matrix version drift (already present: `1.3` vs `1.2`). | Silent capability skew. | P-009. |
| CLI JSON schema drift. | Downstream tooling breakage. | P-010. |
| Cross-impl parity is one-way (Node → Python). | Python-side regressions invisible to CI. | P-011. |
| Envelope tolerates unknown keys silently. | Extension semantics undefined; forward compatibility fragile. | P-012. |
| `retired` attestation status is dead code path. | Spec/code drift on the attestation lifecycle. | P-013 (candidate). |

## 6. Ready-to-normalize invariants (no further decision needed except editorial)

From the Invariant Candidates document, these are the rows marked
"Yes / ready to normalize":

- **AURA-INV-CAN-2** — Insignificant whitespace forbidden in canonical form.
- **AURA-INV-CAN-4** — Arrays preserve input order.
- **AURA-INV-NUM-1** — ES-NumberToString for finite doubles.
- **AURA-INV-NUM-2** — Reject NaN / ±Infinity in canonicalizer.
- **AURA-INV-HASH-1** — SHA-256 → lowercase hex, no separator.
- **AURA-INV-CHN-2** — Genesis = 64×`0x30`.
- **AURA-INV-TMP-1** — Runtime tamper probe requirement.
- **AURA-INV-POR-1** — Independent-verifier portability.
- **AURA-INV-XIM-1** — Per-test-status agreement across impls.
- **AURA-INV-ATT-2** — Trusted registry out-of-band only.
- **AURA-INV-VER-2** — `protocol_version` present; `"unspecified"` meaning.
- **AURA-INV-CLI-1** — Exit codes 0/1/2.

Adopting these does not require any code change and does not commit the
Owner on any of the P-001…P-012 questions. They are the low-risk
scaffolding for the eventual normative spec.

## 7. Blocking-decision dependency graph

```
P-001 ─┬─▶ AURA-INV-CAN-1/3/5, GV-C-001, GV-C-004
       └─▶ (Unicode-key rule) ▶ A-001, A-002, A-010
P-002 ─┬─▶ AURA-INV-NUM-1/2/3, GV-N-001/002/005
       └─▶ A-003, A-004
P-003 ─▶ AURA-INV-HASH-1/2
P-004 ─▶ AURA-INV-CHN-1/4, GV-H-003, A-006
P-005 ─▶ AURA-INV-CHN-2, GV-H-002, A-007
P-006 ─▶ AURA-INV-TIME-1, GV-T-001, GV-A-001, A-008
P-007 ─▶ AURA-INV-CAN-1 (escapes), GV-S-001/002/003, A-009
P-008 ─▶ GV-N-004, A-011
P-009 ─▶ AURA-INV-XIM-2, GV-X-002, A-012
P-010 ─▶ AURA-INV-CLI-1/2, AURA-INV-REP-1, GV-X-001, GV-R-001, A-013
P-011 ─▶ AURA-INV-XIM-1, GV-X-001, A-014
P-012 ─▶ AURA-INV-STR-1, AURA-INV-VER-1/2, AURA-INV-EXT-1, GV-E-001/002, A-015, A-016

P-013 (candidate) ─▶ AURA-INV-ATT-1/2/3, GV-A-001/002/003, A-101/106/107
P-014 (candidate) ─▶ A-102
P-015 (candidate) ─▶ AURA-INV-POL-1, GV-P-001, A-103
P-016 (candidate) ─▶ AURA-INV-CHN-3/4, GV-H-004, A-104
P-017 (candidate) ─▶ AURA-INV-EXT-1, A-105
```

## 8. Recommended sequencing (RECOMMENDATION ONLY)

**Non-binding.** Left to the Owner.

1. Resolve P-001, P-002, P-003, P-004, P-005 first — they are the
   cryptographic core. Every downstream artifact depends on them.
2. Then P-006, P-007 — they finish the canonical byte definition.
3. Then P-012 — envelope + versioning, unblocks the schema freeze.
4. Then P-010, P-011 — unblocks the verifier contract.
5. Then P-008 — failure taxonomy (independent, can slip late).
6. Then P-009 — matrix governance.
7. Finally, decide whether P-013 (attestation) enters the normative spec
   in v1 or as a v1.1 extension.

## 9. Cross-file consistency checks performed

| Check | Result |
|---|---|
| `binding_matrix.json` matrix_version vs `bindingMatrix.js` matrix_version | Consistent (`1.3`). |
| `bindingMatrix.js` matrix_version vs `aura_verify.py` `BINDING_MATRIX_VERSION` | **INCONSISTENT** (`1.3` vs `1.2`) — recorded as A-012, blocked by P-009. |
| `ATTESTATION_VERSION` across JS + Python + docs | Consistent (`"1.0"`). |
| `PROTOCOL_VERSION` across JS + Python | Consistent (`"unspecified"`). |
| `BUNDLE_VERSION` across JS + Python | Consistent (`1`). |
| INV-FLT-01 vectors: JS list vs Python list | Consistent (same 14 vectors). |
| Demo signing-key public hex: `demo-keys.mjs` vs `signingKeys.js` vs (assumed) `/app/config/signing_keys.json` | JS mirror consistent; on-disk JSON file was not opened in this pass (would require re-inspection). |

## 10. Formal completion report

Per Owner directive, this pack explicitly reports:

1. **Files inspected** — see §1 of the Semantic Inventory (16 files).
2. **Code paths traced** — see §2 of the Semantic Inventory.
3. **Documents generated** — six files under `/app/docs/`:
   - `PHASE_3_SEMANTIC_INVENTORY.md`
   - `PHASE_3_PROTOCOL_DECISION_MATRIX.md`
   - `PHASE_3_AMBIGUITY_REGISTER.md`
   - `PHASE_3_GOLDEN_VECTOR_PLAN.md`
   - `PHASE_3_PROTOCOL_INVARIANT_CANDIDATES.md`
   - `PHASE_3_ARCHITECTURE_PACK.md` (this document)
4. **Ambiguities discovered** — 23 total (16 tied to P-001…P-012;
   7 tied to candidate P-013+).
5. **Blocking protocol decisions** — 12 canonical (P-001…P-012) + 5
   discovered (P-013…P-017). All remain **OWNER DECISION REQUIRED**.
6. **Additional discovered domains** — P-013 (attestation), P-014
   (replay), P-015 (policy comparator), P-016 (cascade source), P-017
   (envelope openness). Recorded as candidates only; **not promoted**
   into P-001…P-012.
7. **Confirmation** — **NO production code was changed.** No file under
   `/app/frontend/src/`, `/app/cli/`, `/app/py_verifier/`,
   `/app/frontend/tests/`, `/app/py_verifier/tests/`, or `/app/config/`
   was created, modified, or deleted in the course of producing this
   pack. The only writes made were the six documentation files listed
   above under `/app/docs/`.

## 11. What the Owner MUST do next

1. Read the Decision Matrix and rule on P-001 … P-012.
2. Elect whether to promote any of P-013 … P-017 into the normative
   catalogue.
3. Approve the "ready-to-normalize" invariants of §6 (or revise them).
4. Authorize a Phase-4 code change to align implementation to the ruled
   decisions AND to backfill the golden vectors unblocked by those
   decisions.

Until step 1 is complete, `protocol_version` MUST remain `"unspecified"`
and no evidence bundle produced by this implementation is a "conforming
Aura Protocol bundle" — only a "conforming Aura-Guard implementation
bundle".

---

**End of Phase-3 Architecture Pack.**
