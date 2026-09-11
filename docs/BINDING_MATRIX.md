# AURA-GUARD — PROTOCOL → IMPLEMENTATION BINDING MATRIX v1.0

**NON-NORMATIVE — PENDING AURA PROTOCOL SPECIFICATION**

This document is the authoritative binding between (a) the informal
requirements the Aura-Guard demonstrator claims to enforce and (b) the
concrete executable invariants and check functions in the codebase. It exists
so that no test in the Conformance Core can silently drift away from the
requirement it purports to enforce.

Companion artifact: [`binding_matrix.json`](./binding_matrix.json) — the
machine-readable form consumed by
[`/app/frontend/src/lib/conformanceCore.js`](../frontend/src/lib/conformanceCore.js)
and validated by
[`/app/frontend/tests/bindingMatrix.test.mjs`](../frontend/tests/bindingMatrix.test.mjs).

## Scope and Non-Normativity

- **This is not the Aura Protocol.** Requirement IDs are prefixed `REQ-` and
  invariant IDs are prefixed `INV-` but are **implementation-scoped** until a
  normative Aura specification is supplied.
- **PROTOCOL_VERSION** is reported as `unspecified` by every implementation.
- The pair *(invariant, executable check)* is atomic — one invariant maps to
  exactly one check function in `conformanceCore.js`. Aggregating multiple
  invariants under one check, or a check under no invariant, is forbidden and
  is caught by `bindingMatrix.test.mjs`.
- Every capability that is not yet implemented appears in the matrix with
  `status: NOT_IMPLEMENTED` and `impl_check_id: null` or a check function
  that returns `NOT IMPLEMENTED`. It MUST NOT be reported as PASS.

## Matrix

| Invariant ID | Requirement IDs | Category | Statement (informal) | impl check id | Check function | Status |
|---|---|---|---|---|---|---|
| `INV-STR-01` | `REQ-STR-01`, `REQ-STR-02` | structural | Every decision has non-empty `id` and a full `evidence` object. | `impl:evidence-structure` | `checkEvidenceStructure` | IMPLEMENTED |
| `INV-CAN-01` | `REQ-CAN-01`, `REQ-CAN-02` | canonicalization | `canonicalize(payload_without_evidence)` == `evidence.canonical_representation`. | `impl:canonical-representation` | `checkCanonicalRepresentation` | IMPLEMENTED |
| `INV-HASH-01` | `REQ-HASH-01` | integrity | `sha256Hex(canonical_representation)` == `evidence.canonical_hash`. | `impl:hash-integrity` | `checkSha256Integrity` | IMPLEMENTED |
| `INV-CHN-01` | `REQ-CHN-01`, `REQ-CHN-02`, `REQ-CHN-03` | chain | Genesis: `evidence.prev_hash` at `i=0` == `0`×64. Continuity: `evidence.prev_hash` at `i>0` == recomputed `chain_hash` of `i-1`. Anchor: `evidence.chain_hash` == `sha256Hex(prev_hash \|\| canonical_hash)`. | `impl:chain-continuity` | `checkChainContinuity` | IMPLEMENTED |
| `INV-POL-01` | `REQ-POL-01` | policy | `decision.policy_version` ∈ `session.registered_policy_versions`. | `impl:policy-binding` | `checkPolicyBinding` | IMPLEMENTED |
| `INV-TMP-01` | `REQ-TMP-01` | tamper-detection | Deterministic mutation on isolated clone → verifier reports `canonical_representation:FAIL` AND `sha256_integrity:FAIL`. Original bundle unmodified. | `impl:tamper-detection` | `checkTamperDetection` | IMPLEMENTED |
| `INV-FLT-01` | `REQ-FLT-01` | canonicalization-numeric | Every finite IEEE-754 double is serialized by ECMAScript §6.1.6.1.13 `Number::toString` (bit-exact across JS and Python). `NaN`, `+Infinity`, `-Infinity` are REJECTED. See [`INV_FLT_01_NUMERIC_CANONICALIZATION.md`](./INV_FLT_01_NUMERIC_CANONICALIZATION.md). | `impl:numeric-canonicalization` | `checkNumericCanonicalization` | IMPLEMENTED |
| `INV-POR-01` | `REQ-POR-01` | portability | Exported bundle is independently verified by Node CLI (`/app/cli/aura-verify.mjs`) and Python verifier (`/app/py_verifier/aura_verify.py`) with byte-identical bundle file after verification. | `impl:evidence-portability` | `checkEvidencePortability` | IMPLEMENTED |
| `INV-XIM-01` | `REQ-XIM-01` | cross-implementation | Node and Python verifiers produce identical per-test status for every bundle in the parametric mutation matrix. | `impl:cross-implementation` | `checkCrossImplementation` | NOT_IMPLEMENTED (runtime) |
| `INV-ATT-01` | `REQ-ATT-01` | attestation | Ed25519 signature over the canonical attestation payload verifies against a public key registered as `active` in the trusted out-of-band registry, within its validity window; revoked keys reject regardless of `signed_at`. See [`INV_ATT_01_ATTESTATION_SIGNATURE.md`](./INV_ATT_01_ATTESTATION_SIGNATURE.md). | `impl:attestation-signature` | `checkAttestationSignature` | IMPLEMENTED |

## Requirements (informal, IMPL-scoped)

- **REQ-STR-01** — Every decision record MUST have a stable non-empty identifier.
- **REQ-STR-02** — Every decision record MUST carry an `evidence` object with the four core fields (`canonical_representation`, `canonical_hash`, `prev_hash`, `chain_hash`).
- **REQ-CAN-01** — Payload canonicalization MUST be deterministic: same input → same output.
- **REQ-CAN-02** — Canonical representation stored in evidence MUST equal the re-derived canonicalization at verification time.
- **REQ-HASH-01** — Content integrity MUST be established by cryptographic hash (SHA-256) over the canonical representation.
- **REQ-CHN-01** — Each decision record's `prev_hash` MUST link to the previous record's re-derived chain hash.
- **REQ-CHN-02** — The first decision record's `prev_hash` MUST equal the genesis anchor `0`×64.
- **REQ-CHN-03** — Mutation of any record's payload MUST cascade — every subsequent record's chain check MUST fail.
- **REQ-POL-01** — Every decision MUST reference a policy version that is a member of the session's registered policy set.
- **REQ-TMP-01** — The implementation MUST provide a runtime tamper-detection probe that mutates an isolated clone and verifies that the real verifier detects the mutation.
- **REQ-FLT-01** — Float canonicalization MUST be bit-exact across implementations. *(Locked to ECMAScript `Number::toString`; non-finite numbers REJECTED.)*
- **REQ-POR-01** — An exported evidence bundle MUST be verifiable by at least one implementation independent of the producer, without mutation of the bundle file.
- **REQ-XIM-01** — Two independent implementations MUST agree on the per-test result for every bundle in a shared mutation matrix.
- **REQ-ATT-01** — An attestation signature over a canonical payload MUST verify against a public key that is registered, `active`, non-revoked, and inside its validity window at `signed_at`. *(Ed25519, RFC 8032.)*

## Verification model (summary)

For each decision `i` in bundle order:

1. Compute `canonical := canonicalize(decisions[i] without evidence)`.
2. Compare against `evidence.canonical_representation` — **INV-CAN-01**.
3. Compute `canonical_hash := sha256Hex(canonical)`; compare against `evidence.canonical_hash` — **INV-HASH-01**.
4. Compute `chain_hash := sha256Hex(prev || canonical_hash)`; compare against `evidence.chain_hash` — **INV-CHN-01**.
5. Assert `decision.policy_version ∈ registered_policy_versions` — **INV-POL-01**.
6. `prev` for record `i` is the **re-derived** `chain_hash` of record `i-1` (cascade semantics).

Plus static/structural/runtime checks:

- **INV-STR-01** — structural well-formedness of each record.
- **INV-TMP-01** — runtime tamper probe on isolated clone.
- **INV-POR-01** — asserted PASS at runtime because a positive-and-negative portability test matrix exists in the repository.
- **INV-XIM-01** — reported NOT IMPLEMENTED at runtime; agreement is established out-of-band by the parametric test matrix in `test_cross_impl.py`.
- **INV-ATT-01** — reported NOT IMPLEMENTED (no normative signature spec).
- **INV-FLT-01** — declared canonicalization gap; no runtime check to avoid silent PASS.

## Change control

- The invariant list is closed. Adding an invariant requires: a matrix row, a
  check function, a test in `conformance.test.mjs`, and an update to
  `binding_matrix.json`.
- Removing an invariant requires an explicit deprecation entry (not just
  deletion) so historic evidence bundles remain interpretable.
- The Conformance Core is forbidden from asserting an invariant that has no
  row in this matrix. `bindingMatrix.test.mjs` enforces this.

## Versioning

- `matrix_version` is the version of this matrix (currently `1.0`).
- `verifier_version` is the version of the implementation-level verifier.
- `bundle_version` is the on-wire schema version of the evidence bundle
  (currently `1`, see `BUNDLE_SCHEMA.md`).
- `protocol_version` remains `unspecified` until a normative Aura Protocol
  document is supplied — none of the versions above imply a protocol.
