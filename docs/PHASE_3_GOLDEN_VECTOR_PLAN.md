# PHASE 3 — GOLDEN VECTOR PLAN

**Status:** ANALYSIS ARTIFACT · NON-NORMATIVE · READ-ONLY · P-ID TAXONOMY CORRECTED
**protocol_version:** `unspecified`

Purpose: define the *categories* and *shapes* of golden vectors the
future normative Aura Protocol will need for bit-exact
cross-implementation agreement. All P-ID references have been aligned
to the canonical Phase 3 catalogue. Rows whose expected value depends
on an Owner decision are marked **BLOCKED BY DECISION P-XXX**. No
expected values were fabricated for unresolved semantics.

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

Each entry states:

| Column | Meaning |
|---|---|
| **GV-ID** | Golden-vector row identifier. |
| **Category** | Canonical decision domain(s) it exercises. |
| **Purpose** | The divergence it must catch. |
| **Existing coverage** | What the repository already tests. |
| **Missing coverage** | Specific inputs / shapes still absent. |
| **Blocking decision** | Owner decision required before this vector can be finalized. |

Where an existing implementation value is cited, it is labeled
**CURRENT IMPLEMENTATION EVIDENCE** and MUST NOT be read as a normative
Aura Protocol vector.

---

## 1. Canonicalization vectors (P-001)

### GV-C-001 — Object key ordering (ASCII + Unicode)
- **Category:** P-001.
- **Purpose:** Prove `{"b":1,"a":2}` canonicalizes to `{"a":2,"b":1}`.
- **Existing (CURRENT IMPLEMENTATION EVIDENCE):** Implicit via
  `verification.js#canonicalize` and `aura_verify.py#canonicalize`.
- **Missing:** Byte-exact fixture + Unicode partner (`{ "é":1, "e":2 }`)
  + surrogate-pair partner.
- **Blocking:** BLOCKED BY DECISION P-001 (Unicode ordering).

### GV-C-002 — Empty structures
- **Category:** P-001.
- **Purpose:** Assert `{}` → `"{}"`, `[]` → `"[]"`.
- **Missing:** Byte-exact fixture.
- **Blocking:** BLOCKED BY DECISION P-001 (only editorial once P-001
  ruled).

### GV-C-003 — Nested arrays and objects
- **Category:** P-001.
- **Purpose:** Assert sort applied at every depth.
- **Missing:** Byte-exact fixture.
- **Blocking:** BLOCKED BY DECISION P-001.

### GV-C-004 — Duplicate keys in raw JSON input
- **Category:** P-001.
- **Purpose:** Verifier response to duplicated keys pre-canonicalization.
- **Missing:** Fixture; expected disposition.
- **Blocking:** BLOCKED BY DECISION P-001.

### GV-C-005 — String escape table (ASCII controls, U+2028/2029,
unpaired surrogates)
- **Category:** P-001 (string escape rules affect canonical bytes).
- **Purpose:** Byte-exact escape agreement between JS and Python.
- **Missing:** Full 0x00–0x1F fixture; U+2028/2029 fixture;
  lone-surrogate fixture.
- **Blocking:** BLOCKED BY DECISION P-001.

## 2. Numeric-canonicalization vectors (P-002)

Existing 14 vectors — **CURRENT IMPLEMENTATION EVIDENCE ONLY**:
`0, -0, 1, 1.0, -1, 0.1, 640.0, 128.4, 1e-6, 1e-7, 1e20, 1e21, ±(2^53-1)`.

### GV-N-001 — Subnormal doubles
- **Category:** P-002.
- **Purpose:** Agreement on `5e-324`, `2.2250738585072014e-308`, etc.
- **Blocking:** BLOCKED BY DECISION P-002 (whether subnormals are legal).

### GV-N-002 — Integer boundary
- **Category:** P-002.
- **Purpose:** Agreement on `2^53 - 1`, `2^53`, `2^53 + 1`.
- **Blocking:** BLOCKED BY DECISION P-002 (integer domain).

### GV-N-003 — e-notation interior
- **Category:** P-002.
- **Purpose:** Values adjacent to the ES-NumberToString crossover.
- **Blocking:** BLOCKED BY DECISION P-002 (though algorithm is pinned by
  INV-FLT-01, the *fixture set* is still an Owner call).

### GV-N-004 — Non-finite rejection error taxonomy
- **Category:** P-002 (rejection domain) + **P-012** (error class).
- **Purpose:** Confirm both impls throw for NaN / ±Infinity, with
  shared error taxonomy.
- **Existing (CURRENT IMPLEMENTATION EVIDENCE):** JS throws generic
  `Error`; Python raises `ValueError` — messages equal.
- **Blocking:** BLOCKED BY DECISION P-012 (error class contract).

### GV-N-005 — Python int > 2^53 (bignum)
- **Category:** P-002.
- **Blocking:** BLOCKED BY DECISION P-002.

## 3. Hash vectors (P-003)

### GV-H-001 — Digest case & separator
- **Category:** P-003.
- **Purpose:** Lowercase, no separator, 64 hex chars.
- **Missing:** Byte-exact fixture on a known input.
- **Blocking:** BLOCKED BY DECISION P-003.

## 4. Chain-semantics vectors (P-004)

### GV-CH-001 — Textual vs binary chain concatenation
- **Category:** P-004.
- **Purpose:** Fix `chain_hash = SHA-256( ascii(prev_hex) ‖ ascii(canonical_hash_hex) )`.
- **Missing:** A fixture `prev = "0"×64, canonical_hash = "aa"×32`
  with the expected `chain_hash` value that would fail if a re-impl
  switched to raw-byte concatenation.
- **Blocking:** BLOCKED BY DECISION P-004.

### GV-CH-002 — Genesis anchor byte form
- **Category:** P-004 (genesis is part of chain semantics under the
  canonical mapping; no separate canonical P-ID exists for genesis).
- **Purpose:** Assert `prev_hash[0]` equals exactly the 64-character
  ASCII string `0x30`×64.
- **Existing (CURRENT IMPLEMENTATION EVIDENCE):** Behavior tested;
  byte-identity not fixed at character level.
- **Blocking:** BLOCKED BY DECISION P-004.

### GV-CH-003 — Cascade correctness
- **Category:** P-004 + **P-010** (which prev is authoritative).
- **Purpose:** Mutating record[k] MUST fail record[k] AND every
  subsequent record's `hash_chain_continuity`.
- **Existing (CURRENT IMPLEMENTATION EVIDENCE):** Tamper probe on
  record[0] only.
- **Missing:** Multi-record cascade fixture.
- **Blocking:** BLOCKED BY DECISION P-004 + P-010.

## 5. Bundle envelope vectors (P-005)

### GV-E-001 — `bundle_version` acceptance / rejection
- **Category:** P-005 + **P-009** (versioning).
- **Purpose:** Both impls reject `bundle_version != 1` with exit 2.
- **Existing (CURRENT IMPLEMENTATION EVIDENCE):** Enforced in both CLIs.
- **Missing:** Fixture for `bundle_version = 2` reserved-for-future.
- **Blocking:** BLOCKED BY DECISION P-009 (versioning model).

### GV-E-002 — Envelope required-field enforcement
- **Category:** P-005.
- **Purpose:** Missing envelope fields (`session`,
  `session.decisions`, `id` on any decision) reject with exit 2.
- **Existing (CURRENT IMPLEMENTATION EVIDENCE):** Enforced.
- **Missing:** Full negative matrix per required field.
- **Blocking:** BLOCKED BY DECISION P-005.

## 6. Optional / unknown fields vectors (P-006)

### GV-O-001 — Unknown top-level keys
- **Category:** P-006.
- **Purpose:** Verifier disposition for unknown top-level keys.
- **Existing (CURRENT IMPLEMENTATION EVIDENCE):** Silently tolerated.
- **Blocking:** BLOCKED BY DECISION P-006.

### GV-O-002 — Unknown session-level keys
- **Category:** P-006.
- **Purpose:** Verifier disposition for unknown `session.*` keys.
- **Existing (CURRENT IMPLEMENTATION EVIDENCE):** Silently tolerated
  and passed through.
- **Blocking:** BLOCKED BY DECISION P-006.

### GV-O-003 — Unknown keys inside a decision
- **Category:** P-006 (extension surface) + **P-001** (they participate
  in canonicalization).
- **Blocking:** BLOCKED BY DECISION P-006.

## 7. Policy-binding vectors (P-007)

### GV-P-001 — Case sensitivity of `policy_version`
- **Category:** P-007.
- **Existing (CURRENT IMPLEMENTATION EVIDENCE):** Strict identity (case-
  sensitive).
- **Blocking:** BLOCKED BY DECISION P-007.

### GV-P-002 — SemVer / range comparator (if adopted)
- **Category:** P-007.
- **Blocking:** BLOCKED BY DECISION P-007.

### GV-P-003 — Content-hash binding (if adopted)
- **Category:** P-007.
- **Blocking:** BLOCKED BY DECISION P-007.

## 8. Verification-result-semantics vectors (P-008)

### GV-V-001 — Overall aggregation table
- **Category:** P-008.
- **Purpose:** All 16 combinations of tests emitting {PASS, FAIL, NI, NA}
  → the normative overall verdict.
- **Existing (CURRENT IMPLEMENTATION EVIDENCE):** Rule "FAIL if any FAIL
  else PASS if every test ∈ {PASS, NI, NA} else FAIL".
- **Blocking:** BLOCKED BY DECISION P-008.

### GV-V-002 — Empty-bundle report shape
- **Category:** P-008 + **P-011**.
- **Existing (CURRENT IMPLEMENTATION EVIDENCE):** Node short-circuits;
  Python emits full 10-test table.
- **Blocking:** BLOCKED BY DECISION P-008 + P-011.

## 9. Versioning vectors (P-009)

### GV-VER-001 — `protocol_version` value
- **Category:** P-009.
- **Existing (CURRENT IMPLEMENTATION EVIDENCE):** Both impls emit
  `"unspecified"`.
- **Blocking:** BLOCKED BY DECISION P-009.

### GV-VER-002 — `binding_matrix_version` consistency
- **Category:** P-009 (governance sub-question).
- **Existing (CURRENT IMPLEMENTATION EVIDENCE):** JS `"1.3"` vs Python
  `"1.2"` — see A-012.
- **Blocking:** BLOCKED BY DECISION P-009 (is the field normative?).

## 10. Evidence-boundary vectors (P-010)

### GV-EB-001 — Storage of `canonical_representation`
- **Category:** P-010.
- **Purpose:** Verifier behavior when `evidence.canonical_representation`
  is (a) present and equals re-derived, (b) present and differs,
  (c) absent.
- **Existing (CURRENT IMPLEMENTATION EVIDENCE):** Case (a) PASS; case (b)
  FAIL of `impl:canonical-representation`; case (c) FAIL (structure
  check).
- **Blocking:** BLOCKED BY DECISION P-010 (whether storage is REQUIRED /
  OPTIONAL / FORBIDDEN).

### GV-EB-002 — Stored `prev_hash[i]` vs stored `chain_hash[i-1]`
- **Category:** P-010 + P-004.
- **Purpose:** Behavior when stored `prev_hash[i]` disagrees with stored
  `chain_hash[i-1]` but agrees with the re-derived one, and vice-versa.
- **Existing (CURRENT IMPLEMENTATION EVIDENCE):** Verifier compares
  `prev_hash[i]` to the re-derived `chain_hash[i-1]`.
- **Blocking:** BLOCKED BY DECISION P-010.

## 11. Cross-implementation vectors (P-011)

### GV-X-001 — Full-suite JSON diff on a canonical bundle corpus
- **Category:** P-011.
- **Purpose:** Both verifiers, given the same bundle file, produce
  identical `{id, status}` for every non-`impl:cross-implementation`
  test.
- **Existing (CURRENT IMPLEMENTATION EVIDENCE):** Live spawn from Node
  CLI + `crossImpl.test.mjs` + `test_cross_impl.py`.
- **Missing:** Static frozen JSON reports checked in for offline compare.
- **Blocking:** BLOCKED BY DECISION P-011 (parity rule) + editorial once
  ruled.

### GV-X-002 — Meta-field parity (`binding_matrix_version` etc.)
- **Category:** P-011 + P-009.
- **Blocking:** BLOCKED BY DECISION P-009 + P-011.

## 12. Error / malformed-input vectors (P-012)

### GV-M-001 — Failure-code closed set per check
- **Category:** P-012.
- **Purpose:** Both impls emit the same required code for the same
  failure.
- **Existing (CURRENT IMPLEMENTATION EVIDENCE):** Attestation codes
  match; other checks have no codes.
- **Blocking:** BLOCKED BY DECISION P-012.

### GV-M-002 — Malformed-bundle exit path
- **Category:** P-012.
- **Purpose:** Rejection matrix for missing / non-object / wrong-type
  envelope fields.
- **Existing (CURRENT IMPLEMENTATION EVIDENCE):** Exit 2 with plain
  stderr text on both sides.
- **Blocking:** BLOCKED BY DECISION P-012 (whether structured output is
  required on the exit-2 path).

### GV-M-003 — Non-finite rejection error class
- **Category:** P-012.
- **Existing (CURRENT IMPLEMENTATION EVIDENCE):** JS `Error`, Python
  `ValueError`, both with message `INV-FLT-01: non-finite JSON numbers
  are forbidden`.
- **Blocking:** BLOCKED BY DECISION P-012.

---

## DISCOVERED / CROSS-CUTTING vectors

Not assigned canonical P-IDs.

### GV-D-001 — Timestamp grammar acceptance matrix
- **Depends on:** P-001 (when a timestamp lives inside canonical
  payload), P-010 (evidence timestamps), CANDIDATE P-013 (attestation
  timestamps).
- **Purpose:** Behavior on:
  `2026-02-02T12:00:00Z` (RFC 3339, both accept),
  `2026-02-02T12:00:00.000Z` (both accept),
  `2026-02-02T12:00:00+00:00` (both accept),
  `2026-02-02 12:00:00` (Python accepts; Node varies),
  `2026-02-02T12:00:00` (no offset — Node `Date.parse` accepts).
- **Blocking:** BLOCKED BY DECISION on the P-IDs this cross-cutting
  domain depends on. Owner may additionally elect to define a dedicated
  decision; **not decided here**.

### GV-D-002 — CLI JSON output shape (DISCOVERED)
- **Depends on:** P-011 (minimum payload for cross-impl parity).
- **Blocking:** BLOCKED BY DECISION P-011.

## CANDIDATE P-013+ vectors (DEFERRED)

### GV-C13-001 — Positive attestation golden bundle
- **Candidate domain:** P-013 (attestation governance — DEFERRED).
- **Existing (CURRENT IMPLEMENTATION EVIDENCE):**
  `/app/frontend/tests/attestation.test.mjs`,
  `/app/py_verifier/tests/test_attestation.py`.
- **Blocking:** BLOCKED — attestation is DEFERRED / NON-NORMATIVE
  pending Owner decision to promote P-013.

### GV-C13-002 — Attestation negative matrix
- **Candidate domain:** P-013.
- **Existing (CURRENT IMPLEMENTATION EVIDENCE):** `payload_mismatch`,
  `bad_signature`, `unknown_key`, `revoked_key`, `out_of_window`,
  `algorithm_mismatch`, `unsupported_version`.
- **Missing:** `retired` status vector (documented but unenforced).
- **Blocking:** BLOCKED — DEFERRED (P-013).

### GV-C13-003 — Double-attestation / counter-signature
- **Candidate domain:** P-013.
- **Blocking:** BLOCKED — DEFERRED.

---

## Blocking-decision index

| Decision | Vectors it unlocks |
|---|---|
| **P-001** | GV-C-001, GV-C-002, GV-C-003, GV-C-004, GV-C-005 |
| **P-002** | GV-N-001, GV-N-002, GV-N-003, GV-N-005 |
| **P-003** | GV-H-001 |
| **P-004** | GV-CH-001, GV-CH-002, GV-CH-003 |
| **P-005** | GV-E-001, GV-E-002 |
| **P-006** | GV-O-001, GV-O-002, GV-O-003 |
| **P-007** | GV-P-001, GV-P-002, GV-P-003 |
| **P-008** | GV-V-001, GV-V-002 |
| **P-009** | GV-VER-001, GV-VER-002, GV-E-001, GV-X-002 |
| **P-010** | GV-EB-001, GV-EB-002, GV-CH-003 |
| **P-011** | GV-X-001, GV-X-002, GV-V-002, GV-D-002 |
| **P-012** | GV-M-001, GV-M-002, GV-M-003, GV-N-004 |
| **CANDIDATE P-013 (deferred)** | GV-C13-001, GV-C13-002, GV-C13-003, and cross-cutting timestamp usage in attestation (GV-D-001) |
| **Cross-cutting** | GV-D-001 (timestamps), GV-D-002 (CLI shape) |

## Normative status

Nothing in this plan is normative. No new golden fixture has been added
to the repository. Vectors marked **BLOCKED BY DECISION P-XXX** MUST
NOT be frozen or committed until the Owner rules on the corresponding
decision. Existing implementation test values are **CURRENT
IMPLEMENTATION EVIDENCE** only.
