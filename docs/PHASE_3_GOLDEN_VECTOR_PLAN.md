# PHASE 3 — GOLDEN VECTOR PLAN

**Status:** ANALYSIS ARTIFACT · NON-NORMATIVE · READ-ONLY
**protocol_version:** `unspecified`

Purpose: define the *categories* and *shapes* of golden vectors the
future normative Aura Protocol will need in order to guarantee bit-exact
cross-implementation agreement. This plan intentionally **does not
compute** expected values for any input whose canonical output depends on
an unresolved decision — those rows are marked **BLOCKED BY DECISION
P-XXX** and left to the Owner.

Each entry states:

| Column | Meaning |
|---|---|
| **GV-ID** | Golden-vector row identifier. |
| **Category** | Which invariant / decision domain it exercises. |
| **Purpose** | What divergence it must catch. |
| **Existing coverage** | What the repository already tests. |
| **Missing coverage** | The specific inputs / shapes still absent. |
| **Blocking decision** | Owner decision required before this vector can be finalized (if any). |

---

## 1. Canonicalization vectors

### GV-C-001 — Object key ordering
- **Category:** P-001.
- **Purpose:** Prove `{"b":1,"a":2}` canonicalizes to `{"a":2,"b":1}`.
- **Existing:** Implicit via `verification.js#canonicalize` (`Object.keys(v).sort()`); not asserted with a byte-exact fixture.
- **Missing:** A byte-exact fixture `{ "b":1, "a":2 }` → `{"a":2,"b":1}`, with a Unicode-key partner (`{ "é":1, "e":2 }`) and a surrogate-pair partner.
- **Blocking:** P-001 for Unicode ordering.

### GV-C-002 — Empty structures
- **Category:** P-001.
- **Purpose:** Assert `{}` and `[]` canonicalize to `"{}"` / `"[]"` bytes.
- **Existing:** None explicit.
- **Missing:** Byte-exact fixtures.
- **Blocking:** None.

### GV-C-003 — Nested arrays and objects
- **Category:** P-001.
- **Purpose:** Assert lexicographic sort applies at every depth.
- **Existing:** Exercised via sample bundles but no dedicated fixture.
- **Missing:** Byte-exact fixture with deep sort.
- **Blocking:** None (unless P-001 changes sort semantics).

### GV-C-004 — Duplicate-key pre-canonicalization behavior
- **Category:** P-001.
- **Purpose:** Prove verifier response to a JSON input string containing
  duplicate keys.
- **Existing:** None.
- **Missing:** Fixture bundle JSON with duplicates; expected decision:
  reject at parse, reject at canonicalize, or accept last-wins.
- **Blocking:** BLOCKED BY DECISION P-001.

## 2. Numeric-canonicalization vectors (extension of INV-FLT-01)

Existing 14 vectors (both sides):
`0, -0, 1, 1.0, -1, 0.1, 640.0, 128.4, 1e-6, 1e-7, 1e20, 1e21, ±9007199254740991`.

### GV-N-001 — Subnormal doubles
- **Category:** P-002.
- **Purpose:** Prove agreement on `5e-324` (min positive subnormal),
  `2.2250738585072014e-308` (smallest normal), `1e-308`, `4.9e-324`.
- **Existing:** None.
- **Missing:** Vectors + expected strings.
- **Blocking:** BLOCKED BY DECISION P-002 (whether subnormals are legal).

### GV-N-002 — Integer boundary
- **Category:** P-002.
- **Purpose:** Prove agreement on `2^53 - 1`, `2^53`, `2^53 + 1`.
- **Existing:** Only `±(2^53 - 1)`.
- **Missing:** `2^53`, `2^53 + 1`, `-2^53`, `-2^53 - 1`.
- **Blocking:** BLOCKED BY DECISION P-002 (integer domain).

### GV-N-003 — e-notation interior
- **Category:** P-002.
- **Purpose:** Values near the ES-NumberToString exponential crossover:
  `1e20 - 1`, `1e20 + 1`, `9.999999999999998e20`, `1e-6 - epsilon`,
  `1e-7 + epsilon`.
- **Existing:** Only exact `1e20` and `1e21`.
- **Missing:** Adjacent-representable-double vectors.
- **Blocking:** None (algorithm is pinned by INV-FLT-01).

### GV-N-004 — Non-finite rejection matrix
- **Category:** P-002.
- **Purpose:** Confirm both impls throw for NaN / ±Infinity, with error
  taxonomy alignment.
- **Existing:** JS + Python both throw (asserted). Error class / message
  not asserted.
- **Missing:** Contractual error type (e.g. `ValueError` in Python vs
  generic `Error` in JS) — depends on P-008 decision.
- **Blocking:** BLOCKED BY DECISION P-008 (error taxonomy).

### GV-N-005 — Python int > 2^53
- **Category:** P-002.
- **Purpose:** Behaviour of Python-produced bundle carrying an integer JS
  cannot losslessly re-parse.
- **Existing:** None.
- **Blocking:** BLOCKED BY DECISION P-002.

## 3. Hash / chain vectors

### GV-H-001 — Hex case & separator
- **Category:** P-003.
- **Purpose:** Assert lowercase, no separator, 64 hex chars.
- **Existing:** Implicit.
- **Missing:** Byte-exact fixture.
- **Blocking:** None.

### GV-H-002 — Genesis anchor
- **Category:** P-005.
- **Purpose:** Assert `prev_hash[0]` equals exactly `"0".repeat(64)`
  (the 64 ASCII `0x30` characters).
- **Existing:** Behaviour tested; byte identity not asserted at the
  character level.
- **Blocking:** BLOCKED BY DECISION P-005 (byte form).

### GV-H-003 — Textual concatenation for chain
- **Category:** P-004.
- **Purpose:** Fix `chain_hash = SHA-256( ascii(prev_hex) ‖ ascii(canonical_hash_hex) )`.
- **Existing:** Passes by construction; not asserted against a fixture
  that would fail if the impl switched to raw 32-byte concatenation.
- **Missing:** A vector `prev = "0"×64, canonical_hash = "aa"×32`;
  expected `chain_hash = SHA-256("0"×64 + "aa"×32)`.
- **Blocking:** BLOCKED BY DECISION P-004.

### GV-H-004 — Cascade correctness
- **Category:** P-004 + P-016 (discovered).
- **Purpose:** Mutating record[k] MUST fail record[k] AND every subsequent
  record's `hash_chain_continuity`.
- **Existing:** Tamper probe on record[0] only.
- **Missing:** Multi-record cascade fixture.
- **Blocking:** BLOCKED BY DECISION P-016 (cascade source semantics).

## 4. Policy vectors

### GV-P-001 — Case sensitivity
- **Category:** P-015 (discovered).
- **Purpose:** `"policy-v1"` vs `"Policy-v1"` — same or different?
- **Existing:** Strict `===` (i.e. different).
- **Missing:** Explicit vector; requires P-015 decision.
- **Blocking:** BLOCKED BY DECISION P-015.

## 5. Timestamp vectors

### GV-T-001 — Grammar boundary
- **Category:** P-006.
- **Purpose:** Prove verifier acceptance/rejection matrix for:
  - `2026-02-02T12:00:00Z` ✅ RFC 3339
  - `2026-02-02T12:00:00.000Z` — currently accepted by both, but not required
  - `2026-02-02T12:00:00+00:00` — currently accepted
  - `2026-02-02 12:00:00` — accepted by Python only
  - `2026-02-02T12:00:00` (no offset) — currently accepted by Node
- **Existing:** Only `Z` form used in tests.
- **Missing:** Full acceptance matrix.
- **Blocking:** BLOCKED BY DECISION P-006.

## 6. String / escape vectors

### GV-S-001 — ASCII controls (< 0x20)
- **Category:** P-007.
- **Purpose:** Byte-exact escape output.
- **Existing:** None.
- **Missing:** Full 0x00–0x1F table.
- **Blocking:** BLOCKED BY DECISION P-007.

### GV-S-002 — U+2028 / U+2029
- **Category:** P-007.
- **Purpose:** Assert JS/Python identity on JSON-lawful line-separator
  handling. RFC 8785 escapes them; `json.dumps(ensure_ascii=False)` does
  not.
- **Existing:** None.
- **Blocking:** BLOCKED BY DECISION P-007.

### GV-S-003 — Unpaired surrogate handling
- **Category:** P-007.
- **Purpose:** Legal or illegal?
- **Blocking:** BLOCKED BY DECISION P-007.

## 7. Attestation vectors (candidate P-013)

### GV-A-001 — Positive attestation on demo key
- **Existing:** `/app/frontend/tests/attestation.test.mjs`, `/app/py_verifier/tests/test_attestation.py`.
- **Missing:** Externalized golden bundle (fixed `signed_at`, fixed key)
  with byte-frozen `signed_payload` + `signature`, so any code change
  that alters the signer's canonicalization would fail a static compare.
- **Blocking:** partially P-002 (numeric rule inside signed payload),
  P-006 (timestamp form).

### GV-A-002 — Negative matrix
- **Purpose:** `payload_mismatch`, `bad_signature`, `unknown_key`,
  `revoked_key`, `out_of_window`, `algorithm_mismatch`,
  `unsupported_version`.
- **Existing:** All present in JS + Python test suites.
- **Missing:** `retired` status is documented but not enforced by code
  (see A-101). A conformant impl MAY differ.
- **Blocking:** BLOCKED BY DECISION P-013.

### GV-A-003 — Double-attestation / counter-signature
- **Existing:** None.
- **Missing:** Semantics of a second `attestation` (overwrites? extends?).
- **Blocking:** BLOCKED BY DECISION P-013.

## 8. Cross-implementation vectors

### GV-X-001 — Full-suite JSON diff on a canonical bundle corpus
- **Category:** P-011.
- **Purpose:** Both verifiers, given the exact same bundle file, must
  produce identical `{id, status}` for every non-`impl:cross-implementation`
  test.
- **Existing:** Live spawn in `aura-verify.mjs` + `crossImpl.test.mjs`
  + `test_cross_impl.py`.
- **Missing:** Static golden JSON reports checked into the repo, so the
  cross-impl comparator can run offline.
- **Blocking:** BLOCKED BY DECISION P-010 (JSON schema) + P-011.

### GV-X-002 — Untamperable meta compare
- **Category:** P-009.
- **Purpose:** Require `binding_matrix_version` equal across impls.
- **Existing:** Currently `1.3` (JS) vs `1.2` (Python) — divergent.
- **Blocking:** BLOCKED BY DECISION P-009.

## 9. Envelope / version vectors

### GV-E-001 — `bundle_version` mismatch
- **Category:** P-012.
- **Purpose:** Both impls reject `bundle_version != 1` with exit 2.
- **Existing:** Asserted in Node + Python.
- **Missing:** Vector for `bundle_version = 2` reserved-for-future.
- **Blocking:** BLOCKED BY DECISION P-012 (versioning model).

### GV-E-002 — Extra top-level keys
- **Category:** P-012.
- **Purpose:** Behaviour for unknown top-level keys (tolerate / reject /
  reject-unless-`x-` prefix).
- **Existing:** Silent tolerance in both impls.
- **Blocking:** BLOCKED BY DECISION P-012.

## 10. Reporting-shape vectors

### GV-R-001 — Empty-bundle short-circuit
- **Purpose:** Exactly one FAIL test id `impl:evidence-structure`.
- **Existing:** Node side asserts it. Python side always emits all 10
  tests; empty-case behaviour differs.
- **Missing:** Frozen output shape.
- **Blocking:** BLOCKED BY DECISION P-010.

---

## Deliverable inventory (for a future normative freeze)

For each blocked entry, the corresponding decision unlocks:

| Decision | Vectors it unlocks |
|---|---|
| P-001 | GV-C-001, GV-C-004 |
| P-002 | GV-N-001, GV-N-002, GV-N-005 |
| P-003 | GV-H-001 (final format) |
| P-004 | GV-H-003 |
| P-005 | GV-H-002 |
| P-006 | GV-T-001, GV-A-001 |
| P-007 | GV-S-001, GV-S-002, GV-S-003 |
| P-008 | GV-N-004 |
| P-009 | GV-X-002 |
| P-010 | GV-X-001, GV-R-001 |
| P-011 | GV-X-001 |
| P-012 | GV-E-001, GV-E-002 |
| P-013 (candidate) | GV-A-001, GV-A-002, GV-A-003 |
| P-015 (candidate) | GV-P-001 |
| P-016 (candidate) | GV-H-004 |

## Normative status

Nothing in this plan is normative. No new golden fixture has been added
to the repository. Vectors marked **BLOCKED BY DECISION** MUST NOT be
frozen or committed until the Owner rules on the corresponding decision.
