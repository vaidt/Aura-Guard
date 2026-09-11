# PHASE 3 — PROTOCOL DECISION MATRIX (P-001 … P-012)

**Status:** ANALYSIS ARTIFACT · NON-NORMATIVE · READ-ONLY · P-ID TAXONOMY CORRECTED
**protocol_version:** `unspecified`
**Consumers:** Protocol Owner (normative decisions).
**Producers:** none — this document does not change code or decide protocol.

> **Governance note.** The canonical Phase 3 decision taxonomy was
> restored in a governance correction pass. The 12 IDs below now carry
> their canonical meanings and MUST NOT be reordered, renamed, merged,
> or reused for other domains. Every recommendation is
> **RECOMMENDATION ONLY — NON-BINDING**. Every row remains
> **OWNER DECISION REQUIRED**.

## Canonical mapping (authoritative)

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

Legend: `FACT` = observed in code · `OPT` = enumerated option · `REC` = recommendation only, non-binding · `DEC` = OWNER DECISION REQUIRED.

---

## P-001 — Canonicalization

**Scope.** Object-key ordering (including Unicode ordering), whitespace
policy, in-order arrays, string escape rules that affect canonical bytes,
duplicate-key policy at the canonicalization boundary, canonical payload
construction, canonical representation determinism. **Numeric
representation is governed separately by P-002.**

- **FACT** Both verifiers implement "JCS-lite": sorted keys via JS
  `Object.keys().sort()` / Python `sorted(keys)`, in-order arrays, no
  whitespace, strings via `JSON.stringify` / `json.dumps(..., ensure_ascii=False)`,
  `null`/`true`/`false` literals.
- **FACT** Payload = decision minus `evidence`.
- **FACT** Not proven byte-equivalent to RFC 8785 on Unicode-heavy keys,
  string-escape edge cases, or unpaired-surrogate strings.
- **FACT** Duplicate JSON input keys are invisible to canonicalization
  (already collapsed by `JSON.parse` / `json.loads`); no pre-canonical
  guard exists.
- **OPT A** Adopt RFC 8785 (JCS) verbatim — requires audit of the
  escape table and Unicode key-ordering rule.
- **OPT B** Codify current JCS-lite as `AURA-CANON-1` with an explicit
  escape table, an explicit Unicode key-ordering rule (codepoint / NFC /
  UTF-16 code unit), and an explicit duplicate-key policy.
- **OPT C** A stricter subset (forbid non-BMP keys, empty keys,
  pre-canonicalization duplicate keys).
- **REC (NON-BINDING).** Option B preserves historic evidence, which
  RFC 8785 adoption may invalidate on Unicode/surrogate corner cases.
- **DEC required:** algorithm identity, Unicode key ordering rule,
  string escape table, duplicate-key policy.

## P-002 — Numeric serialization

**Scope.** In-memory number → canonical string form. ECMAScript
`Number::toString`, finite representation, `-0`, NaN/Infinity rejection,
IEEE-754 boundaries, subnormals, 2^53 boundaries, integer/bignum semantics.

- **FACT** `INV_FLT_01_NUMERIC_CANONICALIZATION.md` pins ECMAScript
  §6.1.6.1.13 `Number::toString`.
- **FACT** Non-finite values are REJECTED; `-0` → `"0"`.
- **FACT** 14 reference vectors currently tested; no subnormal,
  no ±2^53±1, no e-notation interior crossovers.
- **FACT** Python allows arbitrary-precision `int` via `str(n)`; JS
  does not.
- **OPT A** Retain ES-NumberToString.
- **OPT B** Add explicit integer clause + forbid bignums outside
  `[-2^53+1, 2^53-1]`.
- **OPT C** Restrict number domain (finite doubles only, forbid
  subnormals).
- **REC (NON-BINDING).** A+B combined, with additional golden vectors
  for subnormals and boundary integers before freeze.
- **DEC required:** integer domain, bignum support, subnormal handling.

## P-003 — Hash domain

**Scope.** SHA-256 pinning, UTF-8 encoding of canonical representation
before hashing, digest representation, lowercase hex, exact hash-input
domain. **Chain linkage semantics live in P-004, not here.**

- **FACT** `sha256Hex` / `sha256_hex` compute SHA-256 over UTF-8 bytes of
  the canonical string and return lowercase hex without separators.
- **FACT** No hash-algorithm identifier is carried on the wire.
- **OPT A** Pin SHA-256 permanently.
- **OPT B** Retain SHA-256 as the default and reserve a
  `hash_algorithm` wire field for future migration.
- **OPT C** Pin a hash family (FIPS 180-4) and negotiate via version.
- **REC (NON-BINDING).** Option B — a one-word field is cheap and
  prevents a v2 fork.
- **DEC required:** whether the wire must carry a hash-algorithm
  identifier; whether digest case / separator are normatively fixed.

## P-004 — Chain semantics

**Scope.** Genesis anchor, `chain_hash` derivation, textual vs binary
concatenation, predecessor semantics (re-derived vs stored), cascade,
mutation propagation, chain continuity.

- **FACT** `chain_hash[i] = SHA-256( ascii(prev_hex[i]) ‖ ascii(canonical_hash_hex[i]) )`
  — textual hex-string concatenation.
- **FACT** `prev_hash[0]` = 64 ASCII `"0"` characters (`0x30`×64).
- **FACT** Verifier uses **re-derived** `chain_hash[i-1]` as expected
  `prev[i]` (cascade semantics).
- **AMBIGUITY** Textual vs raw-byte concatenation is not stated
  normatively — a re-implementer could combine 32-byte digests.
- **AMBIGUITY** Cascade behavior is emergent, not enumerated: alternative
  reading is "compare stored `prev_hash[i]` to stored `chain_hash[i-1]`".
- **OPT A** Textual hex concatenation (current) + explicit statement.
- **OPT B** Raw-byte concatenation → 64 bytes → SHA-256 (incompatible
  with all current bundles).
- **OPT C** Domain-separated construction (e.g. `SHA-256("aura-chain-v1" ‖ prev ‖ canonical_hash)`).
- **OPT D** Genesis definition: 64×`0x30` (current) vs
  `SHA-256("")` vs session-derived.
- **OPT E** Cascade source: re-derived (current) vs stored.
- **REC (NON-BINDING).** Retain textual concatenation, retain
  64×`0x30`, retain re-derived cascade; add normative language.
- **DEC required:** concatenation form, genesis byte form, cascade
  source semantics.

## P-005 — Bundle envelope

**Scope.** Top-level bundle structure, session envelope, required bundle
fields, whether `attestation` is envelope-required, envelope↔decision
relationship. **Extension/unknown fields policy is P-006.**

- **FACT** `bundle_version === 1` accepted; other values → exit 2.
- **FACT** Envelope fields: `bundle_version`, `exported_at`, `source`,
  `note`, `session`. `session` carries a passthrough shape.
- **FACT** `attestation` is currently top-level optional.
- **FACT** Required session fields at verification time:
  `registered_policy_versions`, `decisions` (non-empty array).
- **OPT A** Retain current envelope; declare each field's optionality
  explicitly.
- **OPT B** Promote `attestation` to REQUIRED for a normative Aura
  Protocol; leave it optional in a compatibility mode.
- **OPT C** Split envelope from session (session becomes a separate
  top-level object with its own schema).
- **REC (NON-BINDING).** Option A + explicit optional/required table.
- **DEC required:** exact required field set; envelope↔session boundary;
  whether `attestation` becomes required at envelope level.

## P-006 — Optional / unknown fields

**Scope.** Optional field policy, unknown field policy, forward
compatibility, extension fields, ignored vs rejected fields, open-world
vs closed-world schema behavior.

- **FACT** Both verifiers **silently tolerate** unknown top-level keys
  and unknown `session.*` keys.
- **FACT** Unknown keys inside a `decision` object DO participate in
  canonicalization (they change `canonical_representation` /
  `canonical_hash`), which is the intended extensibility surface.
- **FACT** No allow-list, no `x-` prefix convention, no denial rule.
- **OPT A** Closed-world — unknown keys FAIL.
- **OPT B** Open-world — unknown keys tolerated (current).
- **OPT C** `x-` prefix convention — extensions permitted only under
  `x-*` keys; any other unknown key FAILS.
- **REC (NON-BINDING).** Option C.
- **DEC required:** unknown-key policy at envelope, session, decision,
  and evidence levels.

## P-007 — Policy binding

**Scope.** `policy_version`, `registered_policy_versions`, identifier
matching, comparator semantics (identity / semver / content-hash), case
sensitivity, whitespace normalisation, optional binding to policy content.

- **FACT** `decision.policy_version` MUST be truthy AND ∈
  `session.registered_policy_versions` under strict identity (`===` /
  `in`).
- **FACT** Case sensitivity, whitespace normalisation, semver
  compatibility are NOT defined.
- **FACT** No mechanism binds a decision to a *content hash* of the
  policy; only its identifier.
- **OPT A** Strict identity match (current).
- **OPT B** SemVer-aware comparator (`>=` / `~` / `^`).
- **OPT C** Content-hash binding (decision carries `policy_hash`; verifier
  matches against a registry of known policy hashes).
- **REC (NON-BINDING).** Option A initially; Option C as an evolution
  path once policies themselves are catalogued.
- **DEC required:** comparator, case rule, whether content-hash binding
  is required.

## P-008 — Verification result semantics

**Scope.** Result statuses `PASS`, `FAIL`, `NOT IMPLEMENTED`, `NOT
APPLICABLE`; overall verdict calculation; semantics of partially
implemented capabilities; relationship between individual test status
and overall status. **Failure code taxonomy lives in P-012.**

- **FACT** Statuses: `PASS`, `FAIL`, `NOT IMPLEMENTED`, `NOT APPLICABLE`.
- **FACT** Overall = FAIL if any FAIL; else PASS if every test ∈
  `{PASS, NOT IMPLEMENTED, NOT APPLICABLE}`; else FAIL.
- **AMBIGUITY** A future capability declared `NOT IMPLEMENTED` still
  yields overall PASS; some auditors expect FAIL.
- **AMBIGUITY** `NOT APPLICABLE` (e.g. no attestation) also folds into
  overall PASS — this is a deliberate policy but is nowhere stated
  normatively.
- **OPT A** Retain current rule.
- **OPT B** `NOT IMPLEMENTED` folds to FAIL (strict).
- **OPT C** Introduce a third overall bucket (e.g. `INCOMPLETE`).
- **REC (NON-BINDING).** Option A + explicit prose stating what NA / NI
  mean for overall.
- **DEC required:** normative rule for aggregating {PASS, FAIL, NI, NA}
  into overall.

## P-009 — Versioning

**Scope.** `protocol_version`, `bundle_version`, compatibility rules,
version negotiation, transition, relationship between protocol version
and implementation version. Binding-matrix version governance may be
discussed here **only** where it is specifically a version-governance
issue.

- **FACT** `protocol_version = "unspecified"` in both implementations.
- **FACT** `bundle_version` is a monotonic integer; only `1` accepted.
- **FACT** `verifier_version` is per-impl semver-ish (`aura-guard-conformance-core/0.3.0`, `aura-verify-py/0.3.0`).
- **AMBIGUITY** `binding_matrix_version` is `"1.3"` in JS and hard-coded
  `"1.2"` in Python — cross-impl comparator ignores meta so this
  currently does not FAIL. This is a **governance issue** — whether the
  matrix version becomes a *normative* protocol field is itself an Owner
  decision.
- **OPT A** `bundle_version` stays integer; `min_verifier_version` is
  added.
- **OPT B** `bundle_version` becomes SemVer `major.minor`.
- **OPT C** Introduce explicit version-negotiation on the wire.
- **REC (NON-BINDING).** Option A. Also require both implementations to
  publish the same `binding_matrix_version` **only if** the matrix is
  promoted to a normative field (Owner call).
- **DEC required:** wire-level version semantics; whether
  `binding_matrix_version` is normative or advisory; forward-compat
  policy for `bundle_version > 1`.

## P-010 — Evidence boundary

**Scope.** What constitutes "evidence"; which fields are authoritative
vs independently re-derived; the semantic status of stored
`canonical_representation`, `canonical_hash`, `prev_hash`, `chain_hash`;
evidence portability boundary.

- **FACT** Both verifiers **re-derive** `canonical_representation`,
  `canonical_hash`, `chain_hash` from the payload and only trust the
  re-derivation. Stored fields are compared to re-derived ones — the
  stored values are inputs to a check, not authoritative.
- **FACT** Storage of `canonical_representation` inside evidence is
  documented as **implementation-defined, pending normative Aura
  specification** (`BUNDLE_SCHEMA.md`).
- **FACT** `prev_hash[i]` is compared to the re-derived
  `chain_hash[i-1]`, not the stored one.
- **AMBIGUITY** Whether `canonical_representation` MUST be stored,
  MAY be stored, or MUST NOT be stored is unresolved.
- **AMBIGUITY** Whether stored `prev_hash[i]` MUST equal stored
  `chain_hash[i-1]` (in addition to the re-derived check) is unstated.
- **OPT A** Evidence storage is REQUIRED (current implementation
  behavior).
- **OPT B** Evidence storage is FORBIDDEN — verifier re-derives from
  payload alone, storing only `prev_hash` + `chain_hash`.
- **OPT C** Evidence storage is OPTIONAL — verifier accepts either form.
- **REC (NON-BINDING).** Option A for backward compatibility;
  explicitly state re-derivation is authoritative.
- **DEC required:** evidence field requiredness; authoritative source
  rule; whether stored evidence can be trusted as a fast path when it
  matches re-derived.

## P-011 — Cross-implementation semantics

**Scope.** Independent verifier agreement, reference implementation,
golden-vector parity, status comparison, cross-implementation test
identity, symmetric vs asymmetric parity, live comparison vs offline
corpus, interoperability requirements.

- **FACT** Node CLI spawns Python one-way; Python never spawns Node.
- **FACT** Agreement is per-`(id, status)` equality on common ids
  minus `impl:cross-implementation` itself.
- **FACT** Python side always emits
  `impl:cross-implementation = NOT IMPLEMENTED`.
- **FACT** `id`-based join is fragile if a future impl renames a check.
- **OPT A** Symmetric — both impls MUST spawn each other.
- **OPT B** Reference implementation — one impl is normative; others
  MUST match its JSON report on a golden bundle corpus.
- **OPT C** Test-vector-driven — parity defined on frozen golden
  vectors, not live spawn.
- **OPT D** Include `binding_matrix_version` compatibility as part of
  agreement (see P-009).
- **REC (NON-BINDING).** Option B + Option C, with the Node/Python spawn
  mechanism treated as implementation evidence only, not normative wire
  contract.
- **DEC required:** definition of "agree"; reference-implementation
  status; frozen golden-corpus requirement.

## P-012 — Error / malformed-input semantics

**Scope.** Malformed bundles, parser failures, invalid structures,
invalid canonicalization inputs, invalid numeric values, verifier error
behavior, error classification, exit-code semantics for malformed input.
Failure-code taxonomy lives here.

- **FACT** CLIs exit `0` PASS / `1` FAIL / `2` bad input; both impls
  identical.
- **FACT** Attestation emits distinct codes (`unknown_key`,
  `revoked_key`, `algorithm_mismatch`, `unsupported_version`,
  `unsupported_algorithm`, `malformed_attestation`, `bad_timestamp`,
  `out_of_window`, `payload_mismatch`, `verify_error`, `bad_signature`).
- **FACT** Non-attestation checks emit `PASS`/`FAIL`/`NOT
  IMPLEMENTED`/`NOT APPLICABLE` only, with a free-form `message`.
- **FACT** Non-finite numbers throw:
  JS `Error("INV-FLT-01: non-finite JSON numbers are forbidden")`,
  Python `ValueError("INV-FLT-01: non-finite JSON numbers are forbidden")`.
- **FACT** Bundle-level malformations (`bundle_version != 1`, missing
  `session`, missing `decisions[]`, missing `id`) → CLI exit 2, plain
  stderr message, no structured code.
- **AMBIGUITY** Failure codes are not required across impls;
  cross-impl compare only checks `status`.
- **OPT A** Codes are **advisory** only.
- **OPT B** Codes are **normative** — closed set per check; cross-impl
  compare MUST match codes when both FAIL.
- **OPT C** Two-tier — a normative required code family plus an impl-
  defined `detail`.
- **OPT D** Structured malformed-input errors — bad-input path also
  emits a `{code, detail}` object.
- **REC (NON-BINDING).** Option C + Option D.
- **DEC required:** required-code closed set per test; whether exit 2
  path must also be structured; error-class taxonomy for canonicalizer
  throws.

---

## Cross-cutting note

Every P-001…P-012 remains **OWNER DECISION REQUIRED**. Recommendations
are **RECOMMENDATION ONLY — NON-BINDING**. `protocol_version` remains
`"unspecified"` until Owner rules on these decisions.

Cross-cutting semantic domains discovered during analysis (e.g.
timestamp grammar) are recorded in the Ambiguity Register as
`DISCOVERED / CROSS-CUTTING` and reference the canonical domains they
depend on. They are NOT assigned new canonical P-IDs.
