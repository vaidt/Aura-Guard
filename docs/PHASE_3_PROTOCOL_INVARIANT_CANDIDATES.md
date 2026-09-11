# PHASE 3 — PROTOCOL INVARIANT CANDIDATES

**Status:** ANALYSIS ARTIFACT · NON-NORMATIVE · READ-ONLY
**protocol_version:** `unspecified`

Purpose: enumerate the architectural invariants that a future normative
Aura Protocol specification will need to state, drawing on the current
implementation as *evidence* only. Every candidate below is **CANDIDATE
INVARIANT — OWNER DECISION REQUIRED** and MUST NOT be treated as
normative.

Naming convention (proposal, not normative): `AURA-INV-<CATEGORY>-<n>`
where `<CATEGORY>` is one of `STR`, `CAN`, `NUM`, `HASH`, `CHN`, `POL`,
`TMP`, `POR`, `XIM`, `ATT`, `TIME`, `VER`, `CLI`, `REP`, `EXT`.

Each row: candidate → binding decision → current implementation evidence
→ blocking gaps.

---

## Category STR — Structural

### AURA-INV-STR-1 (candidate)
- **Statement:** Every decision record MUST have a non-empty stable `id`
  and a fully-populated `evidence` object with exactly `{canonical_representation, canonical_hash, prev_hash, chain_hash}`.
- **Bound to decision:** P-012 (envelope openness).
- **Evidence:** INV-STR-01 in `binding_matrix.json`; enforced by
  `checkEvidenceStructure`.
- **Blocking gap:** Whether `evidence.policy_version` echo is required or
  forbidden (currently optional).

### AURA-INV-STR-2 (candidate)
- **Statement:** `session.registered_policy_versions` MUST be a non-empty
  array of non-empty strings.
- **Bound to decision:** P-015 (discovered).
- **Evidence:** Assumed by `verifyDecision`; no explicit non-empty check
  today.

## Category CAN — Canonicalization

### AURA-INV-CAN-1 (candidate)
- **Statement:** Canonicalization is a **total, deterministic function**
  from JSON DAG to byte string; same input MUST produce the same bytes
  in every conforming implementation.
- **Bound to decision:** P-001.
- **Evidence:** INV-CAN-01. Determinism relies on JS `Object.keys().sort()`
  and Python `sorted(keys)` agreeing on ordering.
- **Blocking gap:** Unicode key-ordering rule (see A-001, A-009).

### AURA-INV-CAN-2 (candidate)
- **Statement:** Insignificant whitespace MUST NOT appear in the canonical
  form.
- **Bound to decision:** P-001.
- **Evidence:** Both canonicalizers concatenate directly.

### AURA-INV-CAN-3 (candidate)
- **Statement:** Object keys MUST be sorted by a normatively-defined
  string comparator; a conforming implementation MUST document which
  comparator it uses (choice pending P-001).
- **Bound to decision:** P-001.

### AURA-INV-CAN-4 (candidate)
- **Statement:** Arrays MUST preserve their input order (order is
  semantic).
- **Bound to decision:** P-001.
- **Evidence:** Both impls.

### AURA-INV-CAN-5 (candidate)
- **Statement:** Payload for canonicalization MUST be the decision object
  with the `evidence` key removed (recursively iff future spec extends
  evidence blocks nested elsewhere).
- **Bound to decision:** P-001, P-012.
- **Evidence:** `decisionPayload` in JS, `_payload` in Python.

## Category NUM — Numbers

### AURA-INV-NUM-1 (candidate)
- **Statement:** Every finite IEEE-754 double MUST be serialized by
  ECMAScript §6.1.6.1.13 `Number::toString` (bit-exact).
- **Bound to decision:** P-002.
- **Evidence:** INV-FLT-01.

### AURA-INV-NUM-2 (candidate)
- **Statement:** `NaN`, `+Infinity`, `-Infinity` MUST be rejected by the
  canonicalizer.
- **Bound to decision:** P-002.
- **Evidence:** `canonicalNumberString` throws; Python `_js_number_to_string`
  raises `ValueError`.

### AURA-INV-NUM-3 (candidate — CONDITIONAL on P-002)
- **Statement:** Integer literals MUST lie within `[-2^53+1, 2^53-1]` OR
  the specification MUST define a normative representation for larger
  integers (e.g. explicit `bigint` type marker).
- **Bound to decision:** P-002.
- **Evidence:** Python allows arbitrary ints via `str(n)`; JS cannot round-
  trip past `Number.MAX_SAFE_INTEGER`.

## Category HASH — Hashing

### AURA-INV-HASH-1 (candidate)
- **Statement:** Evidence-content integrity MUST be established by SHA-256
  over UTF-8(canonical_representation), encoded as lowercase hex without
  separators.
- **Bound to decision:** P-003.
- **Evidence:** `sha256Hex` / `sha256_hex`.

### AURA-INV-HASH-2 (candidate)
- **Statement:** The wire format MAY carry a `hash_algorithm` identifier
  to permit future migration (Option B of P-003).
- **Bound to decision:** P-003.

## Category CHN — Chain

### AURA-INV-CHN-1 (candidate)
- **Statement:** `chain_hash[i] = SHA-256( ascii(prev_hex[i]) ‖ ascii(canonical_hash_hex[i]) )`
  where `‖` is TEXTUAL hex-string concatenation.
- **Bound to decision:** P-004.
- **Evidence:** `sha256Hex(prev + canonical_hash)` in JS; equivalent in
  Python.
- **Blocking gap:** Textual vs binary is not currently stated normatively.

### AURA-INV-CHN-2 (candidate)
- **Statement:** `prev_hash[0]` MUST equal the 64-character ASCII string
  `"0"` × 64 (i.e. 64 × `0x30`).
- **Bound to decision:** P-005.

### AURA-INV-CHN-3 (candidate)
- **Statement:** For `i > 0`, `prev_hash[i]` MUST equal the RE-DERIVED
  `chain_hash[i-1]` (cascade semantics).
- **Bound to decision:** P-016 (discovered).
- **Evidence:** `verifySession` uses `prev = r.recomputedChain`.

### AURA-INV-CHN-4 (candidate)
- **Statement:** Any mutation of `payload[k]` MUST cause failure of
  `hash_chain_continuity` for every `i ≥ k`.
- **Bound to decision:** P-004 + P-016.
- **Evidence:** Emergent from CHN-1 + CHN-3.

## Category POL — Policy

### AURA-INV-POL-1 (candidate)
- **Statement:** `decision.policy_version` MUST be a member of
  `session.registered_policy_versions` under a normatively-defined
  comparator (identity, semver, or content-hash — pending P-015).
- **Bound to decision:** P-015 (discovered).
- **Evidence:** `expectedPolicyVersions.has(...)` in JS, `in registered`
  in Python.

## Category TMP — Tamper detection

### AURA-INV-TMP-1 (candidate)
- **Statement:** A conforming verifier MUST provide a runtime probe that
  applies a deterministic mutation to an *isolated* clone of any record
  and confirms that the real verifier flags at least `canonical_representation`
  and `sha256_integrity` as FAIL.
- **Bound to decision:** P-010.
- **Evidence:** `tamperProbe` (JS) and `tamper_probe` (Python).

## Category POR — Portability

### AURA-INV-POR-1 (candidate)
- **Statement:** Any bundle produced by a conforming producer MUST be
  verifiable by every conforming verifier, without mutation of the bundle
  file.
- **Bound to decision:** P-011, P-012.
- **Evidence:** Node CLI + Python CLI verify same file byte-for-byte.

## Category XIM — Cross-implementation

### AURA-INV-XIM-1 (candidate)
- **Statement:** Two independently-implemented verifiers, given the same
  bundle, MUST produce identical `status` for every common non-
  `impl:cross-implementation` test id.
- **Bound to decision:** P-011.
- **Evidence:** `agreementFrom` in `aura-verify.mjs`.

### AURA-INV-XIM-2 (candidate)
- **Statement:** Implementations MUST report `binding_matrix_version`,
  and cross-impl comparison MUST include a matrix-version compatibility
  check (equal, or one is a compatible superset per a decision-defined
  rule).
- **Bound to decision:** P-009.
- **Blocking gap:** Current implementations report different values
  (`1.3` vs `1.2`).

## Category ATT — Attestation (candidate P-013)

### AURA-INV-ATT-1 (candidate)
- **Statement:** Attestation, if present, MUST be an Ed25519 signature
  (RFC 8032) over UTF-8(canonical(payload)) with `payload` shape as
  frozen by the spec (currently 10 fields — see INV_ATT_01 doc).
- **Bound to decision:** P-013 (discovered).

### AURA-INV-ATT-2 (candidate)
- **Statement:** The trusted key registry MUST be delivered out-of-band
  and MUST NOT be embedded in the bundle.
- **Bound to decision:** P-013.

### AURA-INV-ATT-3 (candidate)
- **Statement:** A revoked key MUST cause verification FAIL regardless
  of `signed_at` (retroactive revocation).
- **Bound to decision:** P-013.
- **Blocking gap:** `retired` status is documented but the code only
  checks `revoked`; either the spec MUST drop `retired` or verifiers MUST
  enforce it.

## Category TIME — Timestamps

### AURA-INV-TIME-1 (candidate)
- **Statement:** Every timestamp on the wire MUST use a single
  normatively-defined grammar (RFC 3339 UTC with `Z` is the recommended
  option — see P-006).
- **Bound to decision:** P-006.

## Category VER — Versioning

### AURA-INV-VER-1 (candidate)
- **Statement:** `bundle_version` semantics (integer vs SemVer) MUST be
  fixed.
- **Bound to decision:** P-012.

### AURA-INV-VER-2 (candidate)
- **Statement:** `protocol_version` MUST be reported by every verifier;
  the value `"unspecified"` means "no normative Aura Protocol has been
  frozen for this implementation".
- **Bound to decision:** P-012.

## Category CLI — Verifier CLI

### AURA-INV-CLI-1 (candidate)
- **Statement:** Exit codes: `0 = PASS`, `1 = FAIL`, `2 = bad input`.
- **Bound to decision:** P-010.
- **Evidence:** Both CLIs.

### AURA-INV-CLI-2 (candidate)
- **Statement:** When invoked with `--json`, verifier stdout MUST be a
  single valid JSON document conforming to a normatively-defined schema
  containing at minimum: `protocol_version`, `verifier_version`,
  `bundle_version`, `binding_matrix_version`, `record_count`, `overall`,
  and `tests[].{id,status}`.
- **Bound to decision:** P-010.

## Category REP — Reporting

### AURA-INV-REP-1 (candidate)
- **Statement:** Suite `overall` MUST be `FAIL` if any `tests[].status ==
  FAIL`; otherwise `PASS` iff every test is in the set
  `{PASS, NOT_IMPLEMENTED, NOT_APPLICABLE}`.
- **Bound to decision:** P-012 (some auditors may want `NOT_IMPLEMENTED`
  to force FAIL).

## Category EXT — Extensibility

### AURA-INV-EXT-1 (candidate)
- **Statement:** The specification MUST define whether unknown top-level
  or `session.*` keys are permitted; recommended default: only keys
  prefixed `x-` are tolerated (Option C of P-012).
- **Bound to decision:** P-012.

---

## Cross-reference table

| Candidate | Existing INV in repo | Decision | Ready to normalize? |
|---|---|---|---|
| AURA-INV-STR-1 | INV-STR-01 | P-012 | Partial (evidence field set could still change) |
| AURA-INV-STR-2 | — | P-015 | No — needs P-015 |
| AURA-INV-CAN-1 | INV-CAN-01 | P-001 | No — Unicode ordering |
| AURA-INV-CAN-2 | INV-CAN-01 | P-001 | Yes |
| AURA-INV-CAN-3 | INV-CAN-01 | P-001 | No |
| AURA-INV-CAN-4 | INV-CAN-01 | P-001 | Yes |
| AURA-INV-CAN-5 | INV-CAN-01 | P-001, P-012 | Partial |
| AURA-INV-NUM-1 | INV-FLT-01 | P-002 | Yes for finite doubles |
| AURA-INV-NUM-2 | INV-FLT-01 | P-002 | Yes |
| AURA-INV-NUM-3 | — | P-002 | No |
| AURA-INV-HASH-1 | INV-HASH-01 | P-003 | Yes |
| AURA-INV-HASH-2 | — | P-003 | No |
| AURA-INV-CHN-1 | INV-CHN-01 | P-004 | Partial (textual/binary unstated) |
| AURA-INV-CHN-2 | INV-CHN-01 | P-005 | Yes |
| AURA-INV-CHN-3 | INV-CHN-01 | P-016 | No |
| AURA-INV-CHN-4 | INV-CHN-01 | P-004+P-016 | No |
| AURA-INV-POL-1 | INV-POL-01 | P-015 | No |
| AURA-INV-TMP-1 | INV-TMP-01 | P-010 | Yes |
| AURA-INV-POR-1 | INV-POR-01 | P-011+P-012 | Yes |
| AURA-INV-XIM-1 | INV-XIM-01 | P-011 | Yes |
| AURA-INV-XIM-2 | — | P-009 | No |
| AURA-INV-ATT-1 | INV-ATT-01 | P-013 | Partial |
| AURA-INV-ATT-2 | INV-ATT-01 | P-013 | Yes |
| AURA-INV-ATT-3 | INV-ATT-01 | P-013 | No (retired-status gap) |
| AURA-INV-TIME-1 | — | P-006 | No |
| AURA-INV-VER-1 | — | P-012 | No |
| AURA-INV-VER-2 | — | P-012 | Yes |
| AURA-INV-CLI-1 | — | P-010 | Yes |
| AURA-INV-CLI-2 | — | P-010 | No |
| AURA-INV-REP-1 | — | P-012 | Partial |
| AURA-INV-EXT-1 | — | P-012 | No |

## Normative status

**Non-normative.** No candidate above is a rule until the Owner adopts
it. Renamings such as `AURA-INV-*` are provisional and MUST NOT be
propagated into code, tests, or `binding_matrix.json` before decision.
