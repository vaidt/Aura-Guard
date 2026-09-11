# PHASE 3 — AMBIGUITY REGISTER

**Status:** ANALYSIS ARTIFACT · NON-NORMATIVE · READ-ONLY
**protocol_version:** `unspecified`

Purpose: enumerate every specific piece of behavior currently ambiguous
in the Aura implementation. Each entry links back to a canonical decision
domain **P-001 … P-012** (see
[`PHASE_3_PROTOCOL_DECISION_MATRIX.md`](./PHASE_3_PROTOCOL_DECISION_MATRIX.md)),
or to a **DISCOVERED ADDITIONAL DOMAIN** (`P-013+`) that has NOT been
promoted into the canonical catalogue.

Every row states:

| Column | Meaning |
|---|---|
| **A-ID** | Ambiguity identifier. |
| **Domain** | Canonical decision domain (`P-00X`) or `DISCOVERED / P-01X`. |
| **Observed in** | File / symbol. |
| **Implementation Fact** | What the code does today. |
| **Why it is ambiguous** | A conforming re-implementation could legally diverge here. |
| **Impact if wrong** | Interoperability, evidence integrity, security. |
| **Blocking Owner decision** | The decision that resolves it. |

---

## Canonical-domain ambiguities

### A-001 — Object-key ordering across Unicode
- **Domain:** P-001
- **Observed in:** `verification.js#canonicalize` (`Object.keys(v).sort()`), `aura_verify.py#canonicalize` (`sorted(v.keys())`).
- **Fact:** Both sort by native language default. JS `Array#sort` on
  strings sorts by UTF-16 code units; Python `sorted` sorts by Unicode
  codepoint. These agree on the BMP for ASCII keys, but can disagree on
  surrogate-pair keys.
- **Ambiguity:** No test asserts identical ordering for keys containing
  characters ≥ U+10000.
- **Impact:** Silent divergence of `canonical_representation` for
  Unicode-heavy payloads.
- **Blocking decision:** P-001.

### A-002 — Empty-object and empty-array canonical bytes
- **Domain:** P-001
- **Fact:** Both impls produce `"{}"` and `"[]"` respectively (tested
  implicitly).
- **Ambiguity:** No golden vector asserts these exact bytes; a
  re-implementation could produce `" {} "` if it flushed a buffer wrong.
- **Impact:** Low but breaks hash equality.
- **Blocking decision:** P-001.

### A-003 — Numeric domain boundaries (subnormals, ±2^53)
- **Domain:** P-002
- **Fact:** Vectors cover 0, ±1, 0.1, 640, 128.4, 1e-6, 1e-7, 1e20, 1e21,
  ±MAX_SAFE_INTEGER. **No** subnormal, **no** ±2^53±1, **no** interior
  e-notation crossovers (e.g. 9.999999999999999e20).
- **Ambiguity:** Untested inputs may diverge between JS `String(n)` and
  the Python port.
- **Impact:** Silent evidence corruption for scientific/finance payloads.
- **Blocking decision:** P-002 + Golden Vector Plan (see below).

### A-004 — Python `int` vs `float` split
- **Domain:** P-002
- **Fact:** `aura_verify.py#canonicalize` dispatches `int → str(n)` and
  `float → _js_number_to_string(n)`. JS has no such split.
- **Ambiguity:** For any Python `int` > 2^53, `str(n)` produces a value JS
  cannot reproduce as a `Number`. The wire says nothing about whether
  such integers are legal.
- **Impact:** A Python-produced bundle could contain integers that Node
  will re-canonicalize identically as strings only if the JSON input is
  also treated as `BigInt`. `JSON.parse` in JS turns them into `Number`,
  losing precision.
- **Blocking decision:** P-002 (integer domain).

### A-005 — Hex-digest case
- **Domain:** P-003
- **Fact:** Both produce lowercase hex; no test asserts case.
- **Ambiguity:** A future impl using `toUpperCase()` would silently break
  hash equality.
- **Blocking decision:** P-003.

### A-006 — Textual vs binary hash-chain concatenation
- **Domain:** P-004
- **Fact:** `sha256Hex(prev + canonical_hash)` — string concatenation.
- **Ambiguity:** Nothing in the spec doc explicitly says "textual". A
  re-implementer might combine raw 32-byte digests (much more common
  cryptographic pattern).
- **Impact:** Total hash-chain divergence.
- **Blocking decision:** P-004.

### A-007 — Genesis anchor byte definition
- **Domain:** P-005
- **Fact:** `"0".repeat(64)` — the 64 ASCII characters `0x30`.
- **Ambiguity:** A re-implementer might use 32 raw `0x00` bytes and hex-
  encode them (would yield the same hex string but different bytes for
  the concatenation step of P-004).
- **Blocking decision:** P-005.

### A-008 — Timestamp grammar (RFC 3339 vs broader ISO 8601)
- **Domain:** P-006
- **Fact:** JS uses `Date.parse` (permissive); Python uses
  `datetime.fromisoformat` with `Z→+00:00`.
- **Ambiguity:** `2026-02-02 12:00:00` (space separator) is accepted by
  Python `fromisoformat` but rejected by RFC 3339. `Date.parse` accepts
  many non-8601 strings.
- **Impact:** Attestations verified by one impl and rejected by another.
- **Blocking decision:** P-006.

### A-009 — UTF-16 surrogate handling in strings
- **Domain:** P-007
- **Fact:** JS `JSON.stringify("\uD800")` → `"\"\\ud800\""`; Python
  `json.dumps("\ud800", ensure_ascii=False)` → `'"\\ud800"'` — happens to
  agree today but relies on Python's escaping of unpaired surrogates.
- **Ambiguity:** Not tested; behaviour of other JSON encoders varies.
- **Impact:** Divergent canonical bytes for exotic strings.
- **Blocking decision:** P-007.

### A-010 — Duplicate keys in input
- **Domain:** P-001 / P-007
- **Fact:** Both impls consume already-parsed dicts, so duplicate keys are
  invisible at canonicalization time. However, `JSON.parse` and
  `json.loads` disagree on which value wins.
- **Ambiguity:** No pre-canonicalization guard rejects duplicate keys.
- **Impact:** Two bundles with byte-different input JSON could canonicalize
  to the same string.
- **Blocking decision:** P-001.

### A-011 — Failure-code presence and taxonomy
- **Domain:** P-008
- **Fact:** Attestation has codes; canonical/hash/chain/policy have none.
- **Ambiguity:** Verifiers may report free-form messages.
- **Impact:** Automated remediation across implementations impossible.
- **Blocking decision:** P-008.

### A-012 — Verifier reports `binding_matrix_version` differ
- **Domain:** P-009
- **Fact:** JS reports `"1.3"`; Python hard-codes `"1.2"`.
- **Ambiguity:** No rule forbids drift; cross-impl compare ignores meta.
- **Impact:** Silent drift risk.
- **Blocking decision:** P-009.

### A-013 — CLI JSON output schema
- **Domain:** P-010
- **Fact:** Node emits `label`/`message`/`invariant_id`/`requirement_ids`;
  Python does not.
- **Ambiguity:** No schema; downstream tools cannot rely on either.
- **Blocking decision:** P-010.

### A-014 — Cross-impl direction & test-id join
- **Domain:** P-011
- **Fact:** Node → Python one-way; join is on `id` string equality.
- **Ambiguity:** Renaming a check `id` in one impl silently reduces the
  compared set.
- **Blocking decision:** P-011.

### A-015 — Unknown top-level bundle keys
- **Domain:** P-012
- **Fact:** Tolerated silently by both verifiers.
- **Ambiguity:** Extensibility model undefined.
- **Blocking decision:** P-012.

### A-016 — Overall verdict when only `NOT IMPLEMENTED` / `NOT APPLICABLE`
- **Domain:** P-012 / P-011
- **Fact:** `runConformanceSuite` returns `PASS` if every test ∈ {PASS,
  NOT IMPLEMENTED, NOT APPLICABLE}.
- **Ambiguity:** A future capability declared `NOT IMPLEMENTED` still
  produces overall PASS; some auditors expect that to be FAIL.
- **Blocking decision:** P-012 (or a dedicated P-01X).

---

## DISCOVERED ADDITIONAL DOMAINS (not in P-001…P-012)

These are recorded here **without promoting them into the canonical
catalogue**. Owner may elect to promote any of them in a later phase.

### A-101 — Attestation semantics governance
- **Discovered candidate:** `P-013`
- **Facts:** Ed25519 pinned; canonical payload has 10 fields; revocation
  is retroactive; `retired` status is documented but not enforced by code.
- **Ambiguity:** `retired` state is dead code path; no test exercises it.
- **Impact:** Divergence between doc and code.
- **Owner decision candidate:** whether attestation is normatively part
  of Aura Protocol at all.

### A-102 — Verifier replay/idempotency
- **Discovered candidate:** `P-014`
- **Fact:** Verifier is a pure function of the bundle file (no I/O side
  effects other than reading the key registry).
- **Ambiguity:** Not asserted normatively.
- **Impact:** A future implementation that logs or updates state could
  quietly break third-party trust.

### A-103 — Policy-version comparator
- **Discovered candidate:** `P-015`
- **Fact:** Strict identity match (`===` / `in`).
- **Ambiguity:** SemVer or content-hash matching NOT normative.
- **Impact:** Policy renames silently invalidate audit trails.

### A-104 — Cascade source (stored vs re-derived prev)
- **Discovered candidate:** `P-016`
- **Fact:** Verifier uses **re-derived** `chain_hash[i-1]` as expected
  `prev[i]`.
- **Ambiguity:** Another conforming reading is "compare stored
  `prev_hash[i]` to stored `chain_hash[i-1]`". The two behaviors differ
  ONLY under tampering — the current design fails-early on the first
  tampered record; the alternative fails-late.
- **Impact:** Two implementations could give different error messages
  and, in edge cases, different first-failing-record indices.

### A-105 — Bundle envelope openness
- **Discovered candidate:** `P-017`
- **Fact:** Extra top-level keys tolerated; `session.*` extras tolerated.
- **Ambiguity:** No allow-list; no denial rule.

### A-106 — `aura-sign.mjs` overwrites existing attestation
- **Discovered candidate:** `P-013` (attestation governance)
- **Fact:** `aura-sign.mjs` unconditionally writes `bundle.attestation`.
- **Ambiguity:** Multi-signer, counter-signing, or re-attestation
  semantics not defined.
- **Impact:** Loss of prior attestation on re-sign.

### A-107 — Signed-payload string vs re-canonicalized string on verify
- **Discovered candidate:** `P-013`
- **Fact:** Verifier re-canonicalizes from bundle and compares BYTES to
  `attestation.signed_payload`; then Ed25519-verifies over
  UTF-8(`signed_payload`) (as received).
- **Ambiguity:** If verifier's canonicalizer disagrees with signer's, the
  verifier FAILS `payload_mismatch`. Correct fail-closed behavior but not
  stated normatively.

---

## Summary counts

| Bucket | Count |
|---|---|
| Ambiguities linked to P-001 … P-012 | 16 (A-001 … A-016) |
| Discovered ambiguities (candidate P-013+) | 7 (A-101 … A-107) |
| Total | 23 |

## Normative status

**None** of the entries above are resolved. Every row is **OWNER DECISION
REQUIRED**. No recommendations in this document are binding. This register
is intended as input for the Aura Protocol Owner's decision phase.
