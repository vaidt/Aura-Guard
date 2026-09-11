# PHASE 3 — AMBIGUITY REGISTER

**Status:** ANALYSIS ARTIFACT · NON-NORMATIVE · READ-ONLY · P-ID TAXONOMY CORRECTED
**protocol_version:** `unspecified`

Purpose: enumerate every specific piece of behavior currently ambiguous
in the Aura implementation, reclassified under the **canonical Phase 3
decision catalogue P-001 … P-012**. Findings that do not naturally
belong to a canonical domain are recorded as
**DISCOVERED / CROSS-CUTTING** or as **CANDIDATE P-013+** without being
promoted into the canonical catalogue.

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

Every row states:

| Column | Meaning |
|---|---|
| **A-ID** | Ambiguity identifier (stable across corrections). |
| **Domain** | Canonical P-00X or `DISCOVERED / CANDIDATE`. |
| **Observed in** | File / symbol. |
| **Implementation Fact** | What the code does today. |
| **Why it is ambiguous** | A conforming re-implementation could legally diverge. |
| **Impact if wrong** | Interoperability, evidence integrity, security. |
| **Blocking Owner decision** | The canonical decision that resolves it. |

---

## Ambiguities under canonical P-001 … P-012

### A-001 — Object-key ordering across Unicode
- **Domain:** **P-001** (Canonicalization).
- **Observed:** `verification.js#canonicalize` (`Object.keys(v).sort()`),
  `aura_verify.py#canonicalize` (`sorted(v.keys())`).
- **Fact:** Both sort by native default; agrees on BMP ASCII, may
  diverge on surrogate-pair keys.
- **Ambiguity:** No test asserts identical ordering ≥ U+10000.
- **Impact:** Silent hash divergence.
- **Blocking:** P-001.

### A-002 — Empty-object and empty-array canonical bytes
- **Domain:** **P-001**.
- **Fact:** Both produce `"{}"` / `"[]"`.
- **Ambiguity:** No byte-exact golden fixture asserts this.
- **Impact:** Low but breaks hash equality if a re-impl inserts a byte.
- **Blocking:** P-001.

### A-003 — Numeric domain boundaries (subnormals, ±2^53)
- **Domain:** **P-002** (Numeric serialization).
- **Fact:** Vectors cover none of: subnormals, ±2^53±1, interior
  e-notation crossovers.
- **Ambiguity:** Untested inputs may diverge between JS `String(n)` and
  the Python port.
- **Impact:** Silent evidence corruption on scientific / financial
  payloads.
- **Blocking:** P-002.

### A-004 — Python `int` vs `float` split
- **Domain:** **P-002**.
- **Fact:** `aura_verify.py#canonicalize` dispatches `int → str(n)`,
  `float → _js_number_to_string(n)`. JS has no such split.
- **Ambiguity:** Python `int` > 2^53 is losslessly representable in
  Python but not in JS Number.
- **Impact:** Producer/verifier mismatch for large integers.
- **Blocking:** P-002.

### A-005 — Hex-digest case
- **Domain:** **P-003** (Hash domain).
- **Fact:** Both emit lowercase hex; not asserted by fixture.
- **Ambiguity:** A `toUpperCase()` re-impl would silently fail.
- **Blocking:** P-003.

### A-006 — Textual vs binary hash-chain concatenation
- **Domain:** **P-004** (Chain semantics).
- **Fact:** `sha256Hex(prev + canonical_hash)` — textual string
  concatenation of hex strings.
- **Ambiguity:** Not stated normatively "textual". A re-implementer
  could combine raw 32-byte digests.
- **Impact:** Total chain-hash divergence.
- **Blocking:** P-004.

### A-007 — Genesis anchor byte definition
- **Domain:** **P-004** (Chain semantics — genesis anchor is part of
  chain semantics, not a separate canonical domain).
- **Fact:** `"0".repeat(64)` — 64 ASCII `0x30`.
- **Ambiguity:** A re-implementer might use 32 raw `0x00` bytes and
  hex-encode, or `SHA-256("")`.
- **Impact:** Different concatenation feed → divergent `chain_hash[0]`.
- **Blocking:** P-004.

### A-009 — UTF-16 surrogate handling in strings
- **Domain:** **P-001** (Canonicalization — string escape rules that
  affect canonical bytes).
- **Fact:** JS `JSON.stringify("\uD800")` → `"\"\\ud800\""`; Python
  `json.dumps("\ud800", ensure_ascii=False)` → `'"\\ud800"'`. Happens to
  match today.
- **Ambiguity:** Not tested; other JSON encoders vary.
- **Impact:** Divergent canonical bytes for exotic strings.
- **Blocking:** P-001.

### A-010 — Duplicate keys in input
- **Domain:** **P-001**.
- **Fact:** `JSON.parse` / `json.loads` differ on which value wins for
  duplicate keys; canonicalizer never sees the duplicate.
- **Ambiguity:** No pre-canonicalization guard.
- **Impact:** Two byte-different inputs can canonicalize identically.
- **Blocking:** P-001.

### A-011 — Failure-code presence and taxonomy
- **Domain:** **P-012** (Error / malformed-input semantics).
- **Fact:** Attestation has codes; canonical/hash/chain/policy do not.
- **Ambiguity:** Verifiers may report free-form messages.
- **Impact:** Automated remediation across implementations impossible.
- **Blocking:** P-012.

### A-012 — `binding_matrix_version` drift
- **Domain:** **P-009** (Versioning) — specifically the version-
  governance sub-question of whether `binding_matrix_version` is a
  normative protocol field. If Owner rules "advisory", no drift check is
  required; if "normative", drift is a FAIL.
- **Fact:** JS reports `"1.3"`; Python hard-codes `"1.2"`.
- **Impact:** Silent capability skew today.
- **Blocking:** P-009 (Owner must first decide whether the field is
  normative at all).

### A-014 — Cross-impl direction & test-id join
- **Domain:** **P-011** (Cross-implementation semantics).
- **Fact:** Node → Python one-way; join is `id` string equality.
- **Ambiguity:** Renaming a check `id` silently reduces the compared
  set.
- **Blocking:** P-011.

### A-015 — Unknown top-level bundle keys
- **Domain:** **P-006** (Optional / unknown fields).
- **Fact:** Silently tolerated by both verifiers.
- **Ambiguity:** Extensibility model undefined.
- **Blocking:** P-006.

### A-016 — Overall verdict on `NOT IMPLEMENTED` / `NOT APPLICABLE`
- **Domain:** **P-008** (Verification result semantics).
- **Fact:** `runConformanceSuite` returns `PASS` if every test ∈
  `{PASS, NOT IMPLEMENTED, NOT APPLICABLE}`.
- **Ambiguity:** Some auditors expect `NOT IMPLEMENTED` to fold to FAIL.
- **Blocking:** P-008.

### A-020 — Storage of `canonical_representation` inside evidence
- **Domain:** **P-010** (Evidence boundary).
- **Fact:** Producer stores `canonical_representation` in each
  `evidence` block. `BUNDLE_SCHEMA.md` marks this
  "implementation-defined, pending normative Aura specification".
- **Ambiguity:** REQUIRED / OPTIONAL / FORBIDDEN not decided.
- **Blocking:** P-010.

### A-021 — Stored `prev_hash[i]` vs stored `chain_hash[i-1]`
- **Domain:** **P-010** (Evidence boundary — stored vs re-derived).
  Also touches **P-004** (cascade semantics: verifier uses re-derived
  `chain_hash[i-1]`, not stored, as expected `prev[i]`).
- **Fact:** Verifier uses re-derived cascade; stored `prev_hash[i]`
  correctness against stored `chain_hash[i-1]` is not independently
  checked.
- **Ambiguity:** Two conforming readings (trust stored vs re-derived).
- **Blocking:** P-010 (which fields are authoritative), P-004 (cascade).

### A-022 — Bundle-level malformation error taxonomy
- **Domain:** **P-012** (Error / malformed-input semantics).
- **Fact:** Node CLI: `aura-verify: invalid bundle: <text>` → exit 2.
  Python CLI: `aura-verify-py: invalid bundle: <text>` → exit 2. No
  structured error code.
- **Ambiguity:** No cross-impl taxonomy for bad-input errors.
- **Blocking:** P-012.

### A-023 — Non-finite rejection error class
- **Domain:** **P-012** (Error / malformed-input semantics).
- **Fact:** JS throws generic `Error`; Python raises `ValueError`.
- **Ambiguity:** No shared error class contract.
- **Blocking:** P-012.

### A-024 — Bundle envelope required/optional field list
- **Domain:** **P-005** (Bundle envelope).
- **Fact:** `BUNDLE_SCHEMA.md` marks `note`, `exported_at`, `source` as
  "yes" but verifier only checks `bundle_version`, `session`,
  `session.decisions`. Discrepancy between doc and enforced rule.
- **Blocking:** P-005.

### A-025 — Policy comparator (identity vs semver vs content-hash)
- **Domain:** **P-007** (Policy binding).
- **Fact:** Strict identity match; no case rule; no content-hash.
- **Ambiguity:** Comparator unspecified.
- **Blocking:** P-007.

### A-026 — Empty-bundle overall verdict
- **Domain:** **P-008** (Verification result semantics).
- **Fact:** Empty bundle short-circuits to `overall = FAIL` with only
  `impl:evidence-structure = FAIL` (Node). Python emits full 10-test
  table with `impl:evidence-structure = FAIL`.
- **Ambiguity:** Shape of empty-bundle report is impl-defined.
- **Blocking:** P-008 (aggregation rule) + P-011 (parity).

---

## DISCOVERED / CROSS-CUTTING SEMANTIC DOMAINS (not P-001…P-012)

These are recorded here **without** promoting them into the canonical
catalogue. Each lists its dependencies on canonical decisions.

### A-030 — Timestamp grammar (DISCOVERED / CROSS-CUTTING)
- **Fact:** JS uses permissive `Date.parse`; Python uses
  `datetime.fromisoformat` with `Z→+00:00` shim.
- **Ambiguity:** Neither verifier rejects offset ≠ `Z`, missing offset,
  or ISO-8601 space separator (Python accepts, Node varies).
- **Depends on:**
  - **P-001** when a timestamp enters a canonicalized decision payload
    (its byte form participates in `canonical_representation`).
  - **P-010** when a timestamp is part of stored evidence.
  - **CANDIDATE P-013** if the timestamp is inside an attestation.
- **Owner call:** whether timestamp grammar deserves a new normative
  decision domain is itself an OWNER DECISION and is **not made here**.

### A-031 — CLI JSON output shape (DISCOVERED)
- **Fact:** Node emits `label`/`message`/`invariant_id`/`requirement_ids`;
  Python does not.
- **Depends on:** **P-011** (cross-impl parity minimum payload).
- **Note:** CLI contract is treated as implementation evidence, not part
  of the evidence boundary P-010.

### A-032 — Attestation governance (CANDIDATE P-013 — DEFERRED)
- **Fact:** Ed25519 pinned; 10-field canonical payload; revocation
  retroactive; `retired` status documented but unenforced by both
  verifiers (both check only `revoked`).
- **Depends on:** attestation is DEFERRED / NON-NORMATIVE and its
  governance is not on the P-001…P-012 catalogue. Owner may promote to
  a canonical P-ID later.
- Sub-findings previously enumerated:
  - Overwrite behavior of `aura-sign.mjs` (silently replaces prior
    `attestation`).
  - `signed_payload` string is verified byte-for-byte against a re-
    derived canonical form, then Ed25519 is verified over the RECEIVED
    string.

### A-033 — Verifier replay / idempotency (CANDIDATE P-014)
- **Fact:** By inspection, the verifier is a pure function of the bundle
  file plus the out-of-band key registry.
- **Ambiguity:** Not asserted normatively.
- **Depends on:** could be handled by a normative statement inside
  P-011 or P-010; Owner decision.

---

## Reclassification audit trail (old → canonical)

Preserved for review. Findings preserved verbatim; only P-ID references
were reclassified.

| A-ID | Prior P-ID claim (incorrect) | Corrected canonical domain |
|---|---|---|
| A-001, A-002, A-010 | P-001 | **P-001** (unchanged) |
| A-003, A-004 | P-002 | **P-002** (unchanged) |
| A-005 | P-003 | **P-003** (unchanged) |
| A-006 | P-004 (chain linkage formula — narrower) | **P-004** (chain semantics — broader) |
| A-007 | P-005 (former "genesis anchor" P-ID) | **P-004** (chain semantics) |
| A-008 (timestamps) | P-006 (former "timestamps" P-ID) | **DISCOVERED / CROSS-CUTTING** (see A-030) |
| A-009 | P-007 (former "string encoding" P-ID) | **P-001** (canonicalization escapes) |
| A-011 | P-008 (former "failure codes" P-ID) | **P-012** (error / malformed-input) |
| A-012 | P-009 (former "matrix governance" P-ID) | **P-009** (versioning — governance sub-question) |
| A-013 (CLI JSON) | P-010 (former "CLI contract" P-ID) | **DISCOVERED** (A-031); depends on P-011 |
| A-014 | P-011 | **P-011** (unchanged) |
| A-015 | P-012 (former "envelope + version" P-ID) | **P-006** (optional / unknown fields) |
| A-016 | P-012 (former "envelope + version" P-ID) | **P-008** (verification result semantics) |
| A-101 (attestation governance) | CANDIDATE P-013 | **CANDIDATE P-013** (unchanged, deferred) |
| A-102 (replay) | CANDIDATE P-014 | **CANDIDATE P-014** (unchanged) |
| A-103 (policy comparator) | CANDIDATE P-015 | **P-007** (canonical) — merged; candidate ID retired |
| A-104 (cascade source) | CANDIDATE P-016 | **P-004** + **P-010** — merged; candidate ID retired |
| A-105 (envelope openness) | CANDIDATE P-017 | **P-005** and/or **P-006** — merged; candidate ID retired |
| A-106 (sign overwrite) | CANDIDATE P-013 | **CANDIDATE P-013** (unchanged) |
| A-107 (signed_payload verify path) | CANDIDATE P-013 | **CANDIDATE P-013** (unchanged) |

New rows introduced by the correction to make the mapping complete:

- **A-020** — Storage of `canonical_representation` → **P-010**.
- **A-021** — Stored vs re-derived cascade → **P-010** + **P-004**.
- **A-022** — Malformed bundle error taxonomy → **P-012**.
- **A-023** — Non-finite rejection error class → **P-012**.
- **A-024** — Envelope required/optional field list → **P-005**.
- **A-025** — Policy comparator → **P-007** (absorbs former candidate P-015).
- **A-026** — Empty-bundle overall verdict shape → **P-008** + **P-011**.
- **A-030** — Timestamp grammar → **DISCOVERED / CROSS-CUTTING**.
- **A-031** — CLI JSON output shape → **DISCOVERED** (depends on P-011).
- **A-032** — Attestation governance → **CANDIDATE P-013 / DEFERRED**.
- **A-033** — Verifier replay / idempotency → **CANDIDATE P-014**.

## Summary counts (after correction)

| Bucket | Count |
|---|---|
| Ambiguities under canonical P-001 … P-012 | 20 (A-001..A-002, A-003..A-004, A-005, A-006..A-007, A-009..A-012, A-014..A-016, A-020..A-026) |
| Discovered / cross-cutting (no canonical P-ID) | 2 (A-030, A-031) |
| Candidate P-013+ (deferred) | 2 (A-032, A-033) |
| **Total** | **24 rows** |

Retired candidate IDs after merge into canonical domains: P-015, P-016,
P-017.

## Normative status

No entry is resolved. Every row is **OWNER DECISION REQUIRED**. No
recommendation herein is binding. Aura Protocol `protocol_version`
remains `"unspecified"`.
