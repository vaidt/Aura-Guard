# PHASE 3 — ARCHITECTURE PACK (Final Combined Report)

**Status:** ANALYSIS ARTIFACT · NON-NORMATIVE · READ-ONLY · P-ID TAXONOMY CORRECTED
**protocol_version:** `unspecified`
**Owner:** Aura Protocol Owner (recipient of this pack).
**Producer:** Phase-3 architecture analysis pass — no production code
was written, modified, refactored, or deleted.

This document is the final consolidated deliverable of the Phase-3
Architecture Pack directive, as revised by the Governance Correction
pass. It composes and cross-references the five companion analysis
artifacts:

1. [`PHASE_3_SEMANTIC_INVENTORY.md`](./PHASE_3_SEMANTIC_INVENTORY.md)
2. [`PHASE_3_PROTOCOL_DECISION_MATRIX.md`](./PHASE_3_PROTOCOL_DECISION_MATRIX.md)
3. [`PHASE_3_AMBIGUITY_REGISTER.md`](./PHASE_3_AMBIGUITY_REGISTER.md)
4. [`PHASE_3_GOLDEN_VECTOR_PLAN.md`](./PHASE_3_GOLDEN_VECTOR_PLAN.md)
5. [`PHASE_3_PROTOCOL_INVARIANT_CANDIDATES.md`](./PHASE_3_PROTOCOL_INVARIANT_CANDIDATES.md)

---

## PHASE 3 GOVERNANCE CORRECTION — P-ID TAXONOMY RESTORED

- The initial Phase 3 analysis produced valuable findings on
  canonicalization, numeric serialization, hashing, chain semantics,
  policy binding, attestation, cross-implementation parity, evidence
  storage, and CLI contract behavior. **All of those findings are
  preserved.**
- During documentation generation, several **P-IDs were temporarily
  assigned meanings inconsistent with the canonical Phase 3 taxonomy**
  (in particular P-005 had been misused for "genesis anchor", P-006 for
  "timestamps", P-007 for "string encoding", P-008 for "failure codes",
  P-010 for "CLI contract", and P-012 for "envelope/version compat").
- **This has been corrected.** The canonical P-001 … P-012 mapping is
  now restored across every Phase 3 document, and every previously
  misclassified finding has been re-referenced to its correct canonical
  domain (see the reclassification audit trail in
  [`PHASE_3_AMBIGUITY_REGISTER.md`](./PHASE_3_AMBIGUITY_REGISTER.md#reclassification-audit-trail-old--canonical)).
- **No protocol decision was made by this correction.**
- **No production code was changed.**
- **`protocol_version` remains `"unspecified"`.**
- Candidate IDs previously introduced during the initial pass — P-015,
  P-016, P-017 — have been **retired** because their content is now
  fully covered by canonical P-007, P-004+P-010, and P-005+P-006
  respectively. CANDIDATE P-013 (attestation governance) and CANDIDATE
  P-014 (verifier replay/idempotency) remain **DISCOVERED / DEFERRED**
  and are NOT promoted into the canonical catalogue.
- Timestamp semantics are recorded as
  **DISCOVERED / CROSS-CUTTING SEMANTIC DOMAIN** with dependencies on
  P-001, P-010, and CANDIDATE P-013. **The Owner may later decide
  whether timestamp semantics deserve a dedicated protocol decision.
  That decision is not made here.**

## 1. Canonical decision surface (authoritative)

| ID | Canonical domain |
|---|---|
| **P-001** | Canonicalization |
| **P-002** | Numeric serialization |
| **P-003** | Hash domain |
| **P-004** | Chain semantics |
| **P-005** | Bundle envelope |
| **P-006** | Optional / unknown fields |
| **P-007** | Policy binding |
| **P-008** | Verification result semantics |
| **P-009** | Versioning |
| **P-010** | Evidence boundary |
| **P-011** | Cross-implementation semantics |
| **P-012** | Error / malformed-input semantics |

Full text, enumerated options, and non-binding recommendations for each
decision are in the Decision Matrix.

## 2. Executive summary

Aura-Guard is a **highly-tested, dual-implementation demonstrator**
whose invariants remain explicitly **implementation-scoped**
(`REQ-*` / `INV-*` / `protocol_version = "unspecified"`). Two verifiers
(Node ESM + pure-Python stdlib) agree at runtime on 10 semantic checks
spanning canonicalization, integrity, chain linkage, policy binding,
tamper detection, portability, cross-implementation parity, and Ed25519
attestation.

After the governance-correction pass, Phase 3 records **24 ambiguities**
distributed under the canonical catalogue as follows:

| Domain | Ambiguity rows |
|---|---|
| P-001 Canonicalization | 5 (A-001, A-002, A-009, A-010, plus the empty-structure fixture gap) |
| P-002 Numeric serialization | 2 (A-003, A-004) |
| P-003 Hash domain | 1 (A-005) |
| P-004 Chain semantics | 2 (A-006, A-007) + partial share of A-021 |
| P-005 Bundle envelope | 1 (A-024) |
| P-006 Optional / unknown fields | 1 (A-015) |
| P-007 Policy binding | 1 (A-025) |
| P-008 Verification result semantics | 2 (A-016, A-026) |
| P-009 Versioning | 1 (A-012) |
| P-010 Evidence boundary | 2 (A-020, A-021) |
| P-011 Cross-implementation semantics | 1 (A-014) + shared A-026 |
| P-012 Error / malformed-input semantics | 3 (A-011, A-022, A-023) |
| DISCOVERED / CROSS-CUTTING | 2 (A-030 timestamps, A-031 CLI JSON) |
| CANDIDATE P-013+ (DEFERRED) | 2 (A-032 attestation, A-033 replay) |

**43 candidate architectural invariants** across the canonical catalogue
are enumerated in the Invariant Candidates document, all marked
**CANDIDATE — OWNER REVIEW REQUIRED**.

**No decision has been made in this pack.** The Aura Protocol cannot
transition out of `"unspecified"` until the Owner rules on at least
P-001 … P-012.

## 3. Cross-cutting risk map

Each risk lists the decision(s) that would remove it (all canonical).

| Risk | Failure mode | Removes with |
|---|---|---|
| Unicode-key canonicalization drift between JS and Python. | Silent hash divergence on non-ASCII payloads. | P-001. |
| Numeric drift on subnormals / integer edge / bignum. | Silent evidence corruption. | P-002. |
| Textual-vs-binary hash-chain concatenation misread. | Total chain-hash divergence. | P-004. |
| Genesis anchor byte definition ambiguity. | Chain-hash divergence on record 0. | P-004. |
| Storage of `canonical_representation` inside evidence unresolved. | Different producers/verifiers expect different shapes. | P-010. |
| Free-form failure codes on non-attestation tests. | Automated remediation across impls impossible. | P-012. |
| `binding_matrix_version` drift (`1.3` JS vs `1.2` Python). | Silent capability skew. | P-009 (only if promoted to normative). |
| CLI JSON schema drift. | Downstream tooling breakage. | P-011 (parity minimum payload). |
| Cross-impl parity is one-way (Node → Python). | Python-side regressions invisible in this axis. | P-011. |
| Envelope tolerates unknown keys silently. | Extension semantics undefined. | P-006. |
| `NOT IMPLEMENTED` counts as PASS in overall verdict. | Silent capability regression. | P-008. |
| `retired` attestation status is dead code path. | Doc / code drift. | CANDIDATE P-013 (DEFERRED). |
| Timestamp grammar drift. | Attestation verified by one impl rejected by another. | Cross-cutting; depends on P-001 / P-010 / P-013. |

## 4. Blocking-decision dependency graph

```
P-001 Canonicalization ─┬─▶ AURA-INV-CAN-1..7, GV-C-*, GV-CH-* (via cascade), GV-D-001 (partial)
                        └─▶ Depends on Unicode key ordering + escape table + duplicate-key policy
P-002 Numeric        ─▶ AURA-INV-NUM-1..4, GV-N-001..005, GV-M-003 (with P-012)
P-003 Hash domain    ─▶ AURA-INV-HASH-1..2, GV-H-001
P-004 Chain          ─┬─▶ AURA-INV-CHN-1..4 (includes genesis + cascade)
                      └─▶ GV-CH-001..003
P-005 Envelope       ─▶ AURA-INV-ENV-1..3, GV-E-001..002
P-006 Unknown fields ─▶ AURA-INV-EXT-1..2, GV-O-001..003
P-007 Policy         ─▶ AURA-INV-POL-1..3, GV-P-001..003
P-008 Result sem.    ─▶ AURA-INV-REP-1..4, GV-V-001..002
P-009 Versioning     ─▶ AURA-INV-VER-1..3, GV-VER-001..002, GV-E-001
P-010 Evidence bound ─┬─▶ AURA-INV-EB-1..4, GV-EB-001..002, GV-CH-003
                      └─▶ Depends jointly with P-004 on cascade authority
P-011 Cross-impl     ─▶ AURA-INV-XIM-1..3, GV-X-001..002, GV-D-002
P-012 Error / bad    ─▶ AURA-INV-ERR-1..4, GV-M-001..003, GV-N-004

DISCOVERED / CROSS-CUTTING (no canonical P-ID)
  Timestamps (A-030)   ▶ depends on P-001, P-010, CANDIDATE P-013
  CLI JSON (A-031)     ▶ depends on P-011

CANDIDATE / DEFERRED (NOT promoted)
  P-013 Attestation    ▶ deferred; NOT part of the canonical catalogue in this pack
  P-014 Replay         ▶ deferred
```

## 5. Recommended sequencing — **RECOMMENDATION ONLY — NON-BINDING**

Non-binding order-of-operations offered to help the Owner triage. The
Owner may choose any sequence:

1. **P-001, P-002, P-003, P-004** — the cryptographic and canonical
   byte core; every downstream artifact depends on them.
2. **P-005, P-006** — envelope and extensibility model.
3. **P-010** — pins the evidence boundary rules that P-004 partially
   depends on.
4. **P-007** — policy binding.
5. **P-008, P-011** — reporting semantics and cross-impl parity.
6. **P-009** — versioning (including the sub-question of whether
   `binding_matrix_version` is normative).
7. **P-012** — error / malformed-input taxonomy.
8. **CANDIDATE P-013** — decide whether attestation joins the normative
   spec in v1 or as a v1.1 extension.
9. **Cross-cutting** — decide whether timestamps deserve a dedicated
   protocol decision.

## 6. Cross-file consistency checks performed

| Check | Result |
|---|---|
| `binding_matrix.json` matrix_version vs `bindingMatrix.js` matrix_version | Consistent (`1.3`). |
| `bindingMatrix.js` matrix_version vs `aura_verify.py` `BINDING_MATRIX_VERSION` | **INCONSISTENT** (`1.3` vs `1.2`) — recorded as A-012, blocked by P-009. |
| `ATTESTATION_VERSION` across JS + Python + docs | Consistent (`"1.0"`). |
| `PROTOCOL_VERSION` across JS + Python | Consistent (`"unspecified"`). |
| `BUNDLE_VERSION` across JS + Python | Consistent (`1`). |
| INV-FLT-01 vectors: JS list vs Python list | Consistent (same 14 vectors). |
| Phase 3 document P-ID references (post-correction) | Consistent with canonical P-001…P-012 catalogue (see §14 audit below). |

## 7. What the Owner MUST do next

1. Read the Decision Matrix and rule on P-001 … P-012.
2. Elect whether to promote CANDIDATE P-013 (attestation) and/or
   CANDIDATE P-014 (replay) into the normative catalogue.
3. Elect whether timestamp semantics receive a dedicated protocol
   decision.
4. Authorize a Phase-4 code change to align implementation to the ruled
   decisions AND to backfill the golden vectors unblocked by those
   decisions.

Until step 1 is complete, `protocol_version` MUST remain
`"unspecified"` and no evidence bundle produced by this implementation
is a "conforming Aura Protocol bundle" — only a "conforming Aura-Guard
implementation bundle".

## 8. Final canonical table (for reference)

| ID | Canonical domain |
|---|---|
| P-001 | Canonicalization |
| P-002 | Numeric serialization |
| P-003 | Hash domain |
| P-004 | Chain semantics |
| P-005 | Bundle envelope |
| P-006 | Optional / unknown fields |
| P-007 | Policy binding |
| P-008 | Verification result semantics |
| P-009 | Versioning |
| P-010 | Evidence boundary |
| P-011 | Cross-implementation semantics |
| P-012 | Error / malformed-input semantics |

## 9. Formal completion report

Per Owner directive:

- **A. Documents changed.** All six Phase 3 artifacts:
  `PHASE_3_SEMANTIC_INVENTORY.md`,
  `PHASE_3_PROTOCOL_DECISION_MATRIX.md`,
  `PHASE_3_AMBIGUITY_REGISTER.md`,
  `PHASE_3_GOLDEN_VECTOR_PLAN.md`,
  `PHASE_3_PROTOCOL_INVARIANT_CANDIDATES.md`,
  `PHASE_3_ARCHITECTURE_PACK.md` (this document).
- **B. Findings preserved.** All findings from the initial Phase 3 pass
  (16 canonical A-IDs + 7 candidate discovered-domain rows = 23
  original rows) are preserved. Seven additional rows were added
  during the correction to complete the canonical mapping
  (A-020, A-021, A-022, A-023, A-024, A-025, A-026), yielding a new
  total of **24 rows** after retiring the redundant candidate IDs
  P-015/P-016/P-017 whose content is now fully covered by canonical
  domains.
- **C. Findings reclassified.** The Ambiguity Register contains a full
  reclassification audit trail listing every row whose P-ID mapping was
  corrected (approximately 12 rows moved to a different canonical
  domain; the remaining rows kept their P-ID under the corrected
  meaning).
- **D. Discovered/candidate domains retained separately.**
  - Cross-cutting: A-030 (timestamps), A-031 (CLI JSON).
  - CANDIDATE / DEFERRED: A-032 (P-013 attestation),
    A-033 (P-014 replay).
- **E. Owner decisions still open.** 12 canonical (P-001 … P-012). All
  remain **OWNER DECISION REQUIRED**. Two candidate domains (P-013,
  P-014) are DEFERRED and not part of the canonical catalogue in this
  pack.
- **F. Confirmations.**
  - **NO** production code changed.
  - **NO** tests changed.
  - **NO** protocol semantics were frozen.
  - **NO** normative decision was made.
  - **`protocol_version` remains `"unspecified"`.**
- **G. Final canonical table** — see §8 above and identical mapping at
  the head of every Phase 3 document.

## 10. Governance rule recap

The purpose of this pack is NOT to make Aura Protocol decisions. The
purpose is to make the Phase 3 analysis structurally trustworthy so the
Aura Protocol Owner can make those decisions later.

**Analyze. Reclassify. Document. Do not decide. Do not implement.**

---

**End of Phase-3 Architecture Pack (revised under Governance
Correction).**
