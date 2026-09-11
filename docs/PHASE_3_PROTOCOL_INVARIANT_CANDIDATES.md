# PHASE 3 — PROTOCOL INVARIANT CANDIDATES

**Status:** ANALYSIS ARTIFACT · NON-NORMATIVE · READ-ONLY · P-ID TAXONOMY CORRECTED
**protocol_version:** `unspecified`

Purpose: enumerate the architectural invariants that a future normative
Aura Protocol specification will need to state, drawing on the current
implementation as **evidence only**. Every candidate below is
**CANDIDATE — OWNER REVIEW REQUIRED** and MUST NOT be treated as
normative. All P-ID references have been aligned to the canonical
Phase 3 catalogue.

## Canonical mapping (authoritative)

| ID | Domain |
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

Naming convention (proposal, not normative):
`AURA-INV-<CATEGORY>-<n>` where `<CATEGORY>` is one of `CAN`, `NUM`,
`HASH`, `CHN`, `ENV`, `EXT`, `POL`, `REP`, `VER`, `EB`, `XIM`, `ERR`,
plus `TMP` for the runtime probe requirement.

---

## P-001 · Canonicalization

### AURA-INV-CAN-1 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** Canonicalization is a total, deterministic function
  from JSON DAG to byte string.
- **Evidence:** INV-CAN-01 in `binding_matrix.json`.
- **Blocking:** P-001 (Unicode ordering, escape table).

### AURA-INV-CAN-2 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** No insignificant whitespace may appear in the canonical
  form.
- **Evidence:** Both canonicalizers concatenate directly.
- **Blocking:** P-001.

### AURA-INV-CAN-3 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** Object keys are sorted by a normatively-defined
  comparator; conforming implementations MUST document which comparator
  they use.
- **Blocking:** P-001.

### AURA-INV-CAN-4 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** Arrays preserve their input order (order is semantic).
- **Evidence:** Both impls.
- **Blocking:** P-001.

### AURA-INV-CAN-5 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** Payload for canonicalization = decision object minus
  the `evidence` key.
- **Blocking:** P-001 + P-010 (evidence boundary informs the "minus
  evidence" rule).

### AURA-INV-CAN-6 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** String escape rules for controls (U+0000–U+001F),
  U+2028/2029, and unpaired surrogates MUST be normatively fixed.
- **Blocking:** P-001.

### AURA-INV-CAN-7 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** Duplicate-key policy at canonicalization boundary
  MUST be fixed (reject before parse / last-wins / first-wins).
- **Blocking:** P-001.

## P-002 · Numeric serialization

### AURA-INV-NUM-1 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** Every finite IEEE-754 double is serialized by
  ECMAScript §6.1.6.1.13 `Number::toString`.
- **Evidence:** INV-FLT-01.
- **Blocking:** P-002 (adoption is Owner call).

### AURA-INV-NUM-2 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** `NaN`, `+Infinity`, `-Infinity` are rejected by the
  canonicalizer.
- **Evidence:** Both impls throw.
- **Blocking:** P-002.

### AURA-INV-NUM-3 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** Integer domain is normatively fixed
  (default proposal: `[-2^53+1, 2^53-1]`).
- **Blocking:** P-002.

### AURA-INV-NUM-4 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** Subnormal handling is normatively fixed (accept /
  reject / round-to-zero).
- **Blocking:** P-002.

## P-003 · Hash domain

### AURA-INV-HASH-1 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** Evidence content integrity is established by SHA-256
  over UTF-8(canonical_representation), encoded as lowercase hex without
  separators.
- **Blocking:** P-003.

### AURA-INV-HASH-2 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** Wire MAY carry a `hash_algorithm` identifier for future
  migration.
- **Blocking:** P-003.

## P-004 · Chain semantics

### AURA-INV-CHN-1 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** `chain_hash[i] = SHA-256( ascii(prev_hex[i]) ‖ ascii(canonical_hash_hex[i]) )`
  where `‖` is TEXTUAL hex-string concatenation.
- **Blocking:** P-004 (textual vs binary explicit).

### AURA-INV-CHN-2 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** Genesis anchor `prev_hash[0]` = 64-character ASCII
  string `"0"` × 64 (i.e. 64 × `0x30`).
- **Blocking:** P-004 (genesis is part of chain semantics under the
  canonical mapping).

### AURA-INV-CHN-3 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** Predecessor semantics: for `i > 0`, `prev_hash[i]`
  equals the RE-DERIVED `chain_hash[i-1]` (cascade).
- **Blocking:** P-004 + P-010 (which value is authoritative).

### AURA-INV-CHN-4 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** Any mutation of any record's payload propagates: every
  subsequent record's chain check MUST fail.
- **Blocking:** P-004 + P-010.

## P-005 · Bundle envelope

### AURA-INV-ENV-1 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** Bundle envelope MUST contain `bundle_version` and a
  `session` object; `session` MUST contain a non-empty
  `decisions` array and `registered_policy_versions`.
- **Blocking:** P-005.

### AURA-INV-ENV-2 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** Every decision record MUST carry a non-empty `id`.
- **Blocking:** P-005.

### AURA-INV-ENV-3 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** Presence of the top-level `attestation` block is
  OPTIONAL (v1) or REQUIRED (v2+) — decision open.
- **Blocking:** P-005 (+ CANDIDATE P-013).

## P-006 · Optional / unknown fields

### AURA-INV-EXT-1 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** Unknown-key policy MUST be normatively fixed (open,
  closed, or `x-` prefixed).
- **Blocking:** P-006.

### AURA-INV-EXT-2 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** Unknown keys inside a decision object DO participate
  in canonicalization (they change the canonical bytes), consistent with
  P-001.
- **Blocking:** P-006 + P-001.

## P-007 · Policy binding

### AURA-INV-POL-1 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** `decision.policy_version` MUST be a member of
  `session.registered_policy_versions` under a normatively-defined
  comparator.
- **Evidence:** `checkPolicyBinding`.
- **Blocking:** P-007 (comparator identity vs semver vs content-hash).

### AURA-INV-POL-2 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** Policy identifier case sensitivity and whitespace
  normalisation MUST be fixed.
- **Blocking:** P-007.

### AURA-INV-POL-3 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** Optional binding to a policy content hash may be
  standardised (Option C of P-007).
- **Blocking:** P-007.

## P-008 · Verification result semantics

### AURA-INV-REP-1 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** Result statuses are the closed set
  `{PASS, FAIL, NOT_IMPLEMENTED, NOT_APPLICABLE}`.
- **Blocking:** P-008.

### AURA-INV-REP-2 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** Overall verdict is FAIL if any test is FAIL; else PASS
  if every test is in `{PASS, NOT_IMPLEMENTED, NOT_APPLICABLE}`; else
  FAIL.
- **Evidence:** `runConformanceSuite` (Node) and `run_suite` (Python).
- **Blocking:** P-008 (Owner may prefer NI → FAIL).

### AURA-INV-REP-3 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** Runtime tamper-detection probe requirement: a
  conforming verifier MUST provide a runtime probe that mutates an
  isolated clone of any record and confirms that the real verifier
  flags at least `canonical_representation` and `sha256_integrity` as
  FAIL. (Currently `INV-TMP-01`.)
- **Blocking:** P-008 (probe is a REP obligation) + editorial.

### AURA-INV-REP-4 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** Empty-bundle report shape is normatively fixed.
- **Blocking:** P-008 + P-011.

## P-009 · Versioning

### AURA-INV-VER-1 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** `bundle_version` semantics (integer vs SemVer, forward-
  compat behaviour) is normatively fixed.
- **Blocking:** P-009.

### AURA-INV-VER-2 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** `protocol_version` is reported by every verifier; the
  value `"unspecified"` means "no normative Aura Protocol is in force".
- **Blocking:** P-009.

### AURA-INV-VER-3 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** Whether `binding_matrix_version` is a NORMATIVE
  protocol field or an ADVISORY implementation reporting field is an
  Owner decision. Only under "normative" would drift constitute a FAIL.
- **Blocking:** P-009.

## P-010 · Evidence boundary

### AURA-INV-EB-1 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** Verification MUST re-derive
  `canonical_representation`, `canonical_hash`, `chain_hash` from the
  payload and treat re-derivation as authoritative.
- **Evidence:** Both verifiers.
- **Blocking:** P-010.

### AURA-INV-EB-2 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** Storage of `evidence.canonical_representation` is
  either REQUIRED, OPTIONAL, or FORBIDDEN — normatively fixed.
- **Blocking:** P-010.

### AURA-INV-EB-3 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** Stored `prev_hash[i]` is compared against the
  RE-DERIVED `chain_hash[i-1]` (not the stored one) — the re-derived
  chain is the authoritative source.
- **Blocking:** P-010 + P-004.

### AURA-INV-EB-4 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** Evidence bundles MUST be independently verifiable
  without mutation of the bundle file (portability).
- **Blocking:** P-010 + P-011.

## P-011 · Cross-implementation semantics

### AURA-INV-XIM-1 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** Two independent verifiers, given the same bundle, MUST
  produce identical `status` for every common non-`impl:cross-implementation`
  test id.
- **Evidence:** `agreementFrom` in `aura-verify.mjs`; parity tests.
  The Node→Python spawn mechanism is **implementation evidence**, not
  normative.
- **Blocking:** P-011.

### AURA-INV-XIM-2 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** Parity is defined on a normatively-frozen golden
  bundle corpus (offline), independent of live spawning.
- **Blocking:** P-011.

### AURA-INV-XIM-3 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** Reference implementation designation (if adopted):
  one impl is normative; others MUST match its JSON report.
- **Blocking:** P-011.

## P-012 · Error / malformed-input semantics

### AURA-INV-ERR-1 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** Verifier CLI exit codes: `0 = PASS`, `1 = FAIL`,
  `2 = malformed / bad input`.
- **Evidence:** Both CLIs.
- **Blocking:** P-012.

### AURA-INV-ERR-2 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** Failure-code taxonomy per test is normatively fixed
  (Option B or C of P-012).
- **Blocking:** P-012.

### AURA-INV-ERR-3 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** Canonicalizer error class for non-finite / non-JSON
  inputs is normatively fixed (currently JS generic `Error` vs Python
  `ValueError`).
- **Blocking:** P-012.

### AURA-INV-ERR-4 (CANDIDATE — OWNER REVIEW REQUIRED)
- **Statement.** Bundle-level malformation errors (missing envelope
  fields, wrong `bundle_version`, missing `id`) emit a structured
  `{code, detail}` object on the exit-2 path.
- **Blocking:** P-012.

---

## Cross-reference table

| Candidate | Canonical domain(s) | Existing INV in repo | Status |
|---|---|---|---|
| AURA-INV-CAN-1 | P-001 | INV-CAN-01 | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-CAN-2 | P-001 | INV-CAN-01 | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-CAN-3 | P-001 | INV-CAN-01 | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-CAN-4 | P-001 | INV-CAN-01 | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-CAN-5 | P-001 + P-010 | INV-CAN-01 | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-CAN-6 | P-001 | — | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-CAN-7 | P-001 | — | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-NUM-1 | P-002 | INV-FLT-01 | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-NUM-2 | P-002 | INV-FLT-01 | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-NUM-3 | P-002 | — | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-NUM-4 | P-002 | — | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-HASH-1 | P-003 | INV-HASH-01 | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-HASH-2 | P-003 | — | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-CHN-1 | P-004 | INV-CHN-01 | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-CHN-2 | P-004 | INV-CHN-01 | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-CHN-3 | P-004 + P-010 | INV-CHN-01 | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-CHN-4 | P-004 + P-010 | INV-CHN-01 | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-ENV-1 | P-005 | INV-STR-01 | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-ENV-2 | P-005 | INV-STR-01 | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-ENV-3 | P-005 + CAND. P-013 | — | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-EXT-1 | P-006 | — | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-EXT-2 | P-006 + P-001 | — | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-POL-1 | P-007 | INV-POL-01 | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-POL-2 | P-007 | — | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-POL-3 | P-007 | — | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-REP-1 | P-008 | (impl STATUS enum) | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-REP-2 | P-008 | `runConformanceSuite` | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-REP-3 | P-008 | INV-TMP-01 | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-REP-4 | P-008 + P-011 | — | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-VER-1 | P-009 | — | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-VER-2 | P-009 | — | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-VER-3 | P-009 | (A-012 drift) | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-EB-1 | P-010 | INV-CAN-01/HASH-01/CHN-01 | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-EB-2 | P-010 | — | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-EB-3 | P-010 + P-004 | INV-CHN-01 | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-EB-4 | P-010 + P-011 | INV-POR-01 | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-XIM-1 | P-011 | INV-XIM-01 | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-XIM-2 | P-011 | — | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-XIM-3 | P-011 | — | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-ERR-1 | P-012 | — | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-ERR-2 | P-012 | (attestation codes) | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-ERR-3 | P-012 | INV-FLT-01 throw | CANDIDATE — OWNER REVIEW REQUIRED |
| AURA-INV-ERR-4 | P-012 | — | CANDIDATE — OWNER REVIEW REQUIRED |

## Cross-cutting / candidate (not P-001…P-012)

- **Timestamp semantics (DISCOVERED / CROSS-CUTTING).** No candidate
  invariant is proposed at Aura Protocol level in this pack. Timestamps
  depend on P-001 (canonicalized payload), P-010 (evidence), and
  CANDIDATE P-013 (attestation). The Owner may elect to promote a
  dedicated decision; **not decided here**.
- **CLI JSON schema (DISCOVERED).** Depends on P-011 minimum payload.
- **CANDIDATE P-013 — Attestation governance (DEFERRED).** Ed25519,
  key lifecycle, revocation retroactivity, `retired` status, counter-
  signature. NOT PROMOTED to canonical catalogue. Not addressed in this
  pack.
- **CANDIDATE P-014 — Verifier replay / idempotency (DEFERRED).**

## Normative status

**Non-normative.** No candidate above is a rule until the Owner adopts
it. Renamings such as `AURA-INV-*` are provisional and MUST NOT be
propagated into code, tests, or `binding_matrix.json` before decision.
No prior "Ready to normalize" language survives this correction — every
row is **CANDIDATE — OWNER REVIEW REQUIRED**.
