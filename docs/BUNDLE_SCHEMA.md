# AURA-GUARD IMPLEMENTATION BUNDLE SCHEMA

**NON-NORMATIVE — PENDING AURA PROTOCOL SPECIFICATION**

This document describes the *implementation-level* schema of the evidence
bundle produced and consumed by the Aura-Guard demonstrator and its
standalone verifier CLI. It is **not** the Aura Protocol schema. When the
normative Aura Protocol specification is frozen, this document is expected
to be superseded and this implementation must be aligned to it.

## Top-level envelope

| Field            | Type    | Required | Meaning                                                                 | Validation                              | In verification | Stored / derived |
|------------------|---------|----------|-------------------------------------------------------------------------|-----------------------------------------|-----------------|------------------|
| `bundle_version` | integer | yes      | Implementation bundle format version.                                   | Must equal `1`.                         | No (envelope)   | Stored           |
| `exported_at`    | string  | yes      | ISO-8601 timestamp of export.                                           | Non-empty string.                       | No (envelope)   | Stored           |
| `source`         | string  | yes      | `"imported"` if the loaded session already carried evidence, else `"synthesized-from-source"`. | One of the two literals. | No (envelope)   | Stored           |
| `note`           | string  | yes      | Human note stating this is a demonstrator artifact.                     | Non-empty string.                       | No              | Stored           |
| `session`        | object  | yes      | Session payload (see below).                                            | Object.                                 | Yes (contents)  | Stored           |

## `session` object

| Field                          | Type       | Required | Meaning                                                | Validation                                       | In verification | Stored / derived |
|--------------------------------|------------|----------|--------------------------------------------------------|--------------------------------------------------|-----------------|------------------|
| `session_id`                   | string     | optional | Human/session identifier.                              | String if present.                               | No              | Stored           |
| `session_name`                 | string     | optional | Human label for the session.                           | String if present.                               | No              | Stored           |
| `organization`                 | string     | optional | Organization name.                                     | String if present.                               | No              | Stored           |
| `auditor`                      | string     | optional | Auditor label.                                         | String if present.                               | No              | Stored           |
| `generated_at`                 | string     | optional | ISO-8601 timestamp for session generation.             | String if present.                               | No              | Stored           |
| `registered_policy_versions`   | string[]   | yes      | Policy versions accepted by the verifier for this session. | Array of non-empty strings.                   | Yes             | Stored           |
| `decisions`                    | object[]   | yes      | Ordered decision records (order is semantic).          | Non-empty array of decision objects.             | Yes             | Stored           |

Extra keys on `session` are tolerated and passed through unchanged; they do not participate in verification.

## `decisions[i]` object

| Field            | Type   | Required | Meaning                                                     | Validation                                | In verification                            | Stored / derived |
|------------------|--------|----------|-------------------------------------------------------------|-------------------------------------------|--------------------------------------------|------------------|
| `id`             | string | yes      | Stable decision identifier.                                 | Non-empty string.                         | Yes (structure test)                       | Stored           |
| `timestamp`      | string | optional | ISO-8601 timestamp of the decision.                         | String if present.                        | Yes (participates in canonical payload)    | Stored           |
| `model`          | string | optional | Model identifier that produced the decision.                | String if present.                        | Yes (participates in canonical payload)    | Stored           |
| `subject`        | string | optional | Decision subject reference.                                 | String if present.                        | Yes (participates in canonical payload)    | Stored           |
| `action`         | string | optional | Action code.                                                | String if present.                        | Yes (participates in canonical payload)    | Stored           |
| `policy_version` | string | yes      | Policy version applied to this decision.                    | Must be a member of `session.registered_policy_versions`. | Yes (policy binding + canonical payload) | Stored           |
| `policy_status`  | string | optional | `"compliant"` \| `"warning"` \| `"violation"` (UI classification only). | String if present.               | Participates in canonical payload only     | Stored           |
| `reason`         | string | optional | Human reason for the decision.                              | String if present.                        | Yes (participates in canonical payload)    | Stored           |
| `input`          | object | optional | Input to the decision.                                      | Object if present.                        | Yes (participates in canonical payload)    | Stored           |
| `output`         | object | optional | Output of the decision.                                     | Object if present.                        | Yes (participates in canonical payload)    | Stored           |
| `evidence`       | object | yes      | Evidence block (see below).                                 | Object.                                   | Yes                                        | Stored + derived fields |

## `decisions[i].evidence` object

| Field                       | Type   | Required | Meaning                                                                                                    | Validation                                                                                                     | In verification | Stored / derived |
|-----------------------------|--------|----------|------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------|-----------------|------------------|
| `canonical_representation`  | string | yes\*    | Serialized canonical JSON of the decision payload (excluding `evidence`).                                  | Must equal `canonicalize(payload)` on re-derivation. **Implementation-defined; pending normative Aura spec.** | Yes             | Stored (re-derived on verify) |
| `canonical_hash`            | string | yes      | Hex SHA-256 of `canonical_representation`.                                                                 | Must equal `sha256Hex(canonical_representation)` on re-derivation.                                             | Yes             | Stored (re-derived) |
| `prev_hash`                 | string | yes      | `chain_hash` of the previous decision; genesis = 64×`0`.                                                   | For i=0 must equal `"0".repeat(64)`; for i>0 must equal the re-derived `chain_hash` of the previous decision.  | Yes             | Stored (re-derived) |
| `chain_hash`                | string | yes      | Hex SHA-256 of `prev_hash \|\| canonical_hash`.                                                            | Must equal `sha256Hex(prev_hash + canonical_hash)` on re-derivation.                                           | Yes             | Stored (re-derived) |
| `policy_version`            | string | optional | Redundant echo of the record's `policy_version`.                                                           | If present, string.                                                                                            | No              | Stored           |

\* `canonical_representation` is present in bundles produced by this implementation. Its storage is **implementation-defined and pending normative Aura specification** — a future normative schema may require it, forbid it, or redefine its shape.

## Verification model (summary)

1. For each decision, re-derive `canonical := canonicalize(payload_without_evidence)`.
2. Compare to `evidence.canonical_representation` (canonical-representation check).
3. Re-derive `canonical_hash := sha256Hex(canonical)`; compare to stored (integrity check).
4. Re-derive `chain_hash := sha256Hex(prev + canonical_hash)`; compare to stored (chain-continuity check).
5. Assert `policy_version ∈ registered_policy_versions` (policy binding).
6. `prev` for record `i` is the **re-derived** `chain_hash` of record `i-1` (cascade semantics — implementation choice).

## Versioning

- `bundle_version` is the version of THIS implementation bundle.
- `verifier_version` is the version of the implementation-level verifier.
- `protocol_version` is `"unspecified"` and MUST NOT be confused with either of the above until a normative Aura Protocol version exists.
