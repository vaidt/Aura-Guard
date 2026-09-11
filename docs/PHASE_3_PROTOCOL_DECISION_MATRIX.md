# PHASE 3 — PROTOCOL DECISION MATRIX (P-001 … P-012)

**Status:** ANALYSIS ARTIFACT · NON-NORMATIVE · READ-ONLY
**protocol_version:** `unspecified`
**Consumers:** Protocol Owner (normative decisions).
**Producers:** none — this document does not change code or decide protocol.

Each row records: (a) the semantic question, (b) implementation FACTS,
(c) enumerated OPTIONS, and (d) a **RECOMMENDATION ONLY** flag. Every
decision is **OWNER DECISION REQUIRED** and remains open until the
Protocol Owner rules on it.

The 12 domains below are the closed catalogue for Phase 3. Newly discovered
domains are recorded separately as `P-013+` in
[`PHASE_3_AMBIGUITY_REGISTER.md`](./PHASE_3_AMBIGUITY_REGISTER.md) and MUST
NOT silently be promoted into P-001…P-012.

Legend: `FACT` = observed in code · `OPT` = enumerated option · `REC` = recommendation only, non-binding · `DEC` = OWNER DECISION REQUIRED.

---

## P-001 — Canonicalization algorithm identity

**Question.** Which canonicalization spec does Aura normatively adopt for
JSON payloads (object-key order, whitespace, string escapes, member set)?

- **FACT** Both verifiers implement "JCS-lite": sorted keys via
  JS `Array#sort` / Python `sorted(keys)`, in-order arrays, no whitespace,
  strings via `JSON.stringify` / `json.dumps(..., ensure_ascii=False)`.
- **FACT** Numeric rule is delegated to P-002 (INV-FLT-01).
- **FACT** Not proven byte-equivalent to RFC 8785 (JCS) on Unicode-heavy
  keys, string-escape edge cases, or bignum handling.
- **OPT A** Adopt RFC 8785 (JCS) verbatim. Requires escape-set audit.
- **OPT B** Codify current JCS-lite as `AURA-CANON-1` with an explicit
  escape table + Unicode key ordering rule (NFC? codepoint? UTF-16 code
  unit?).
- **OPT C** Adopt a stricter subset (e.g. forbid non-BMP keys, forbid empty
  keys, forbid duplicate keys pre-canonicalization).
- **REC (non-binding).** Option B, because current sample bundles and hash
  values were produced under it; migrating to RFC 8785 would invalidate
  historic evidence.
- **DEC required:** algorithm identity + Unicode key ordering + escape
  table.

## P-002 — Numeric serialization

**Question.** What is the normative mapping from an in-memory number to
its canonical string form?

- **FACT** `INV_FLT_01_NUMERIC_CANONICALIZATION.md` pins **ECMAScript
  §6.1.6.1.13 `Number::toString`**.
- **FACT** Non-finite values (`NaN`, `±Infinity`) are REJECTED (throw).
- **FACT** `-0` → `"0"`.
- **FACT** 14 reference vectors currently tested; **no** subnormal, no
  boundary (2^53±1), no e-notation interior crossovers.
- **FACT** Python side accepts arbitrary-precision `int`; JS side has no
  such notion. Behaviour for `int` > 2^53 is untested.
- **OPT A** Retain ES-NumberToString exactly as pinned in INV-FLT-01.
- **OPT B** Add explicit integer clause: JSON tokens without `.`/`e/E` MUST
  be serialized as their decimal representation, and integer literals
  outside `[-2^53+1, 2^53-1]` are FORBIDDEN.
- **OPT C** Restrict number domain further (finite `double` only; forbid
  denormals).
- **REC.** Option A + B combined. Add golden vectors for subnormals and
  boundary integers before freeze.
- **DEC required:** integer domain, bignum support, subnormal handling.

## P-003 — Hash function

**Question.** Which cryptographic hash normatively binds evidence?

- **FACT** SHA-256 over UTF-8(canonical) → lowercase hex, no separator.
- **FACT** Pinned in `sha256Hex` (JS `SubtleCrypto.digest("SHA-256")`)
  and `hashlib.sha256(...).hexdigest()`.
- **OPT A** Pin SHA-256 permanently.
- **OPT B** Introduce an algorithm identifier field so future versions can
  migrate (e.g. `hash_algorithm: "sha-256"`).
- **OPT C** Pin a hash family (e.g. FIPS 180-4) and negotiate via
  `bundle_version`.
- **REC.** Option B — a one-word field is cheap and prevents a v2 fork.
- **DEC required:** whether the wire format must carry a hash-algorithm
  identifier.

## P-004 — Hash-chain linkage formula

**Question.** How is `chain_hash[i]` normatively derived from `prev` and
`canonical_hash`?

- **FACT** `chain_hash[i] = SHA-256(prev[i] ‖ canonical_hash[i])` where
  `‖` is **hex-string concatenation** (128 hex chars → 128 hex-char string
  → UTF-8 bytes → SHA-256).
- **FACT** This is textual concatenation, **not** raw-byte concatenation
  of the two 32-byte digests.
- **OPT A** Retain textual hex concatenation (current).
- **OPT B** Redefine as raw-byte concatenation → 64 bytes → SHA-256.
  Cleaner cryptographically; **incompatible with all current bundles.**
- **OPT C** Use a domain-separated construction (e.g. HKDF label /
  `SHA-256("aura-chain-v1" ‖ prev ‖ canonical_hash)`).
- **REC.** Option A for backward compatibility, but explicitly state that
  concatenation is textual to prevent implementer error.
- **DEC required:** wire form of the concatenation; whether domain
  separation is mandated.

## P-005 — Genesis anchor

**Question.** How is the first record's `prev_hash` normatively defined?

- **FACT** 64 ASCII `"0"` characters (the string `"0".repeat(64)`).
- **FACT** Used identically by both verifiers.
- **OPT A** Retain literal 64×`0`.
- **OPT B** Redefine as SHA-256("") or as some domain-tagged constant to
  make it impossible to confuse with an accidentally zeroed field.
- **OPT C** Introduce a `session_anchor` derived from
  `session_id`/`generated_at` for domain separation across sessions.
- **REC.** Option A with normative language stating "the literal 64-char
  ASCII string `0x30`×64", to remove any doubt about raw-byte 0×32 vs the
  text `"0"`×64.
- **DEC required:** exact byte definition of the genesis anchor.

## P-006 — Timestamps & time zone

**Question.** What normative format applies to `decision.timestamp`,
`attestation.signed_at`, `session.generated_at`, and key registry
`valid_from`/`valid_until`?

- **FACT** All timestamps are represented as strings in the current wire
  format.
- **FACT** Verifiers parse via JS `Date.parse` (permissive) and Python
  `datetime.fromisoformat` with a `Z→+00:00` shim (RFC 3339 + broader ISO
  8601).
- **FACT** No verifier currently *rejects* an offset ≠ `Z` or a missing
  offset — the two implementations agree only by convention.
- **OPT A** Require **RFC 3339 UTC with `Z`** (e.g. `2026-02-02T12:00:00Z`).
- **OPT B** Allow any RFC 3339 offset; canonicalize to UTC before hashing.
- **OPT C** Move to integer Unix milliseconds (unambiguous but throws away
  human readability).
- **REC.** Option A with strict rejection.
- **DEC required:** exact grammar, whether decimal seconds are permitted,
  whether the ISO-8601 shim is normative or transitional.

## P-007 — String / character encoding & escape rules

**Question.** What encoding and escape rules apply to strings (both keys
and values) inside the canonical form?

- **FACT** JS uses `JSON.stringify` (UTF-16 source → produces `\uXXXX` for
  controls and lone surrogates; escapes `"` and `\\`).
- **FACT** Python uses `json.dumps(v, ensure_ascii=False)` which produces
  raw UTF-8 for all non-ASCII printable characters.
- **AMBIGUITY** These are byte-equivalent for ASCII-only strings but their
  behavior on lone surrogates and on U+2028/U+2029 has NOT been proven
  identical.
- **OPT A** Pin RFC 8785 §3.2.2 escape table (minimal escapes; U+2028/2029
  raw).
- **OPT B** Pin ECMAScript `JSON.stringify` escape behaviour.
- **OPT C** Pin Python `json.dumps(ensure_ascii=False)` behaviour.
- **REC.** Option A for cross-language stability; then update both
  implementations under a controlled bundle_version bump.
- **DEC required:** definitive escape table; whether unpaired surrogates
  are legal input at all.

## P-008 — Verifier error / failure code semantics

**Question.** Are failure codes part of the normative wire contract, or
implementation-defined?

- **FACT** Attestation currently exposes distinct codes: `unknown_key`,
  `revoked_key`, `algorithm_mismatch`, `unsupported_version`,
  `unsupported_algorithm`, `malformed_attestation`, `bad_timestamp`,
  `out_of_window`, `payload_mismatch`, `verify_error`, `bad_signature`.
- **FACT** Non-attestation checks emit `PASS`/`FAIL`/`NOT IMPLEMENTED`/
  `NOT APPLICABLE` only; there is no code taxonomy for canonical/hash/
  chain/policy failures.
- **AMBIGUITY** Cross-impl comparator only compares `id` + `status`, so
  different codes across implementations are not caught.
- **OPT A** Codes are **advisory** — implementations MAY emit any string;
  only `status` is normative.
- **OPT B** Codes are **normative** — enumerated closed set per check,
  cross-impl comparison MUST match codes when both FAIL.
- **OPT C** Two-tier taxonomy: a normative required-code family (e.g.
  `payload_mismatch`) and an implementation-defined `detail` payload.
- **REC.** Option C.
- **DEC required:** which codes are required, which are optional.

## P-009 — Binding-matrix governance & requirement-ID namespace

**Question.** Is `REQ-*-*` / `INV-*-*` normative? Who owns the matrix?

- **FACT** `binding_matrix.json` version `1.3` (JS-side) vs verifier
  hard-coded `BINDING_MATRIX_VERSION = "1.2"` (Python side).
- **FACT** No mechanism forces both to stay in sync — cross-impl compare
  ignores meta.
- **FACT** REQ/INV IDs are declared "IMPL-scoped" in
  `BINDING_MATRIX.md`.
- **OPT A** Publish matrix as an appendix of the Aura Protocol; freeze at
  matrix_version = protocol_version.
- **OPT B** Keep matrix implementation-scoped; Aura Protocol references
  invariants only by prose.
- **OPT C** Split into normative invariants (`AURA-INV-*`) and
  informational implementation checks (`impl:*`), verifier reports both.
- **REC.** Option C, with a governance rule that any mismatch in
  `binding_matrix_version` between implementations is a FAIL of INV-XIM-01.
- **DEC required:** matrix ownership, matrix-version compat rule.

## P-010 — Verifier CLI contract & JSON schema

**Question.** Is there a normative external contract for verifier CLIs
and their JSON output?

- **FACT** Exit codes `0/1/2` are documented in both CLIs.
- **FACT** JSON output shape differs across impls: Node reports
  `label`/`message`/`invariant_id`/`requirement_ids`; Python does not.
- **FACT** No JSON Schema (.json/.yaml) exists for the suite output.
- **OPT A** Publish a normative JSON Schema for the verifier report;
  require both impls to conform.
- **OPT B** Standardise exit codes + `overall` field only; free-form rest.
- **OPT C** Two report levels: minimal (id + status) and rich (impl-
  defined additions).
- **REC.** Option C, with a normative minimal payload that the cross-impl
  comparator uses.
- **DEC required:** minimal payload schema; whether stdout MUST be
  machine-parseable JSON when `--json` is passed.

## P-011 — Cross-implementation parity protocol

**Question.** How is "two implementations agree" normatively defined?

- **FACT** Currently defined by Node CLI as: same `status` on each common
  test `id` excluding `impl:cross-implementation`.
- **FACT** Direction is asymmetric: Node calls Python; Python never calls
  Node, and Python always emits `impl:cross-implementation = NOT
  IMPLEMENTED`.
- **FACT** `id`-based join is fragile if a future implementation renames a
  check.
- **OPT A** Symmetric parity — both implementations MUST spawn the other,
  agreement is bi-directional.
- **OPT B** Reference implementation — one impl is normative; others
  MUST match its JSON report on a golden bundle corpus.
- **OPT C** Test-vector-driven — parity is defined on golden vectors, not
  live spawn.
- **REC.** Option B + C: designate a normative reference and mandate the
  golden corpus.
- **DEC required:** reference-implementation status; golden bundle
  registry.

## P-012 — Evidence bundle envelope & version compatibility

**Question.** How is bundle-format evolution normatively governed?

- **FACT** `bundle_version` is currently pinned at `1`; other values are
  rejected with exit 2 in both CLIs.
- **FACT** No SemVer semantics: it is a monotonically-increasing integer.
- **FACT** Extra top-level or `session` keys are tolerated silently.
- **FACT** `attestation` is currently optional.
- **OPT A** Strict SemVer at wire level (`major.minor`) with a
  `min_verifier_version` field.
- **OPT B** Retain integer, but require verifiers to *fail closed* on
  unknown top-level keys.
- **OPT C** Explicit extension registry — unknown keys under a `x-` prefix
  are tolerated; anything else FAILS.
- **REC.** Option C.
- **DEC required:** version semantics, extensibility model, whether
  `attestation` becomes REQUIRED.

---

## Cross-cutting note

None of the 12 decisions above have been made in this document. All are
recorded as **OWNER DECISION REQUIRED**. Any recommendation is
**RECOMMENDATION ONLY** and MUST NOT be treated as a normative rule
without explicit Owner approval. `protocol_version` remains `"unspecified"`
until the Owner rules on P-001 … P-012 at minimum.
