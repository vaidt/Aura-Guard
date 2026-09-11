# PHASE 3 — SEMANTIC INVENTORY

**Status:** ANALYSIS ARTIFACT · NON-NORMATIVE · READ-ONLY · P-ID TAXONOMY CORRECTED
**protocol_version:** `unspecified`

Enumerates every semantic surface an Aura verifier currently depends on,
tagged and cross-referenced to the **canonical Phase 3 decision
catalogue** (P-001 … P-012). No source code, test, or configuration was
modified to produce this document.

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

Every row is tagged with one of:

| Tag | Meaning |
|---|---|
| **FACT** | Implementation fact directly observed in source. |
| **TESTED** | Behavior asserted by a test in this repository. |
| **ASSUMPTION** | Implementation assumption the code depends on but does not state normatively. |
| **AMBIGUITY** | Behavior is currently under-specified. |
| **INV-CANDIDATE** | Architectural invariant candidate (see companion Invariant Candidates doc). |
| **OWNER-DECISION** | Requires a normative decision by the Protocol Owner. |

---

## 1. Files inspected (this Phase-3 pass)

| Path | Role |
|---|---|
| `/app/frontend/src/lib/verification.js` | JS canonicalizer, `sha256Hex`, `buildHashChain`, `verifyDecision`, `verifySession`. |
| `/app/frontend/src/lib/canonicalNumber.js` | JS numeric canonicalization + reference vectors. |
| `/app/frontend/src/lib/conformanceCore.js` | Suite orchestration, INV → check-function binding, tamper probe, result shape. |
| `/app/frontend/src/lib/attestation.js` | Ed25519 attestation payload build / sign / verify. |
| `/app/frontend/src/lib/signingKeys.js` | JS-side trusted key registry mirror. |
| `/app/frontend/src/lib/bindingMatrix.js` | Code-side mirror of `binding_matrix.json`. |
| `/app/frontend/src/lib/exportBundle.js` | Bundle envelope construction. |
| `/app/py_verifier/aura_verify.py` | Python reference verifier (stdlib only). |
| `/app/py_verifier/ed25519_ref.py` | Pure-Python Ed25519 verify. |
| `/app/cli/aura-verify.mjs` | Node CLI verifier + cross-impl spawn harness. |
| `/app/cli/aura-sign.mjs` | Node CLI attestation signer. |
| `/app/cli/demo-keys.mjs` | Demo signing key pair (non-production). |
| `/app/docs/BUNDLE_SCHEMA.md` | Current bundle schema (implementation-level). |
| `/app/docs/BINDING_MATRIX.md` + `binding_matrix.json` | Requirement/invariant binding matrix (impl-scoped). |
| `/app/docs/INV_FLT_01_NUMERIC_CANONICALIZATION.md` | Current numeric rule doc. |
| `/app/docs/INV_ATT_01_ATTESTATION_SIGNATURE.md` | Current attestation doc. |

## 2. Code paths traced

- **Verification (Node):** `aura-verify.mjs → runConformanceSuite → verifySession → verifyDecision → canonicalize + sha256Hex`; then cross-impl spawn to `py_verifier/aura_verify.py`.
- **Verification (Python):** `aura_verify.main → validate_bundle → run_suite → verify_decision → canonicalize + sha256_hex`; `check_attestation → verify_attestation → ed25519_ref.verify`.
- **Signing (Node CLI):** `aura-sign.mjs → buildAttestationPayload → canonicalPayloadString → Node crypto.sign(null, …, ed25519PrivateKey)` → attach `attestation` block.
- **Chain re-derivation for attestation:** `attestation.js#deriveFinalChainHash → verifySession → recomputedChain` (uses *re-derived* chain, not stored `chain_hash`).
- **Tamper probe:** `conformanceCore.tamperProbe → deep clone → mutate `.reason` → verifyDecision on clone → expect `canonical_representation:false && sha256_integrity:false`.

## 3. Semantic surfaces (canonical enumeration)

### 3.1 Bundle envelope (P-005)

| Surface | Location | Tag | Note |
|---|---|---|---|
| `bundle_version === 1` accepted by both verifiers. | `exportBundle.js`, `aura-verify.mjs#validateBundle`, `aura_verify.py#validate_bundle` | FACT / TESTED | Any other value → exit 2. |
| `exported_at`, `source`, `note` fields carried in envelope. | `exportBundle.js` | FACT | Not part of verification. |
| `session` is a passthrough of the imported session shape. | `exportBundle.js`, `BUNDLE_SCHEMA.md` | FACT | Extra top-level `session` fields tolerated (see §3.2 / P-006). |
| Envelope required-field list in `BUNDLE_SCHEMA.md` (`note`, `exported_at`, `source`) is not enforced by the verifiers. | Both CLIs | ASSUMPTION | Documented as "yes" but verifier only enforces `bundle_version`, `session`, `session.decisions`. |
| Top-level `attestation` block is OPTIONAL. | Both verifiers | FACT | Absent → `impl:attestation-signature = NOT APPLICABLE`. |
| **Blocking decision:** **P-005**. |  |  |  |

### 3.2 Optional / unknown fields (P-006)

| Surface | Location | Tag | Note |
|---|---|---|---|
| Extra top-level bundle keys silently tolerated. | Both verifiers | FACT | Not part of verification. |
| Extra `session.*` keys silently tolerated. | Both verifiers | FACT | Not part of verification. |
| Extra keys inside a decision **participate in canonicalization** (they change `canonical_representation`). | Both canonicalizers | FACT | Emergent extension surface. |
| **Blocking decision:** **P-006** (and P-001 for the "participate in canonicalization" branch). |  |  |  |

### 3.3 Canonicalization (P-001)

| Surface | Location | Tag | Note |
|---|---|---|---|
| Object keys sorted by JS `Object.keys().sort()` / Python `sorted(keys)`. | `verification.js`, `aura_verify.py` | FACT | Agrees on BMP ASCII; not proven on non-BMP. |
| Arrays preserved in-order. | Both | FACT / TESTED | Order is semantic. |
| No whitespace between tokens. | Both | FACT | |
| Strings via `JSON.stringify` / `json.dumps(..., ensure_ascii=False)`. | Both | FACT | Escape agreement not proven byte-for-byte on U+2028/2029, unpaired surrogates. |
| `null` → `"null"`, booleans → `"true"/"false"`. | Both | FACT | |
| Numbers via P-002 rule. | See §3.4. | FACT | |
| Payload for canonicalization = decision minus `evidence`. | `verification.js#decisionPayload`, `aura_verify.py#_payload` | FACT | Cross-references P-010 (evidence boundary). |
| Duplicate JSON input keys are invisible to canonicalization. | Both | ASSUMPTION | `JSON.parse` / `json.loads` resolve upstream. |
| **Blocking decision:** **P-001**. |  |  |  |

### 3.4 Numeric canonicalization (P-002)

| Surface | Location | Tag | Note |
|---|---|---|---|
| Rule = ECMAScript §6.1.6.1.13 `Number::toString` (INV-FLT-01). | `canonicalNumber.js`, `aura_verify.py#_js_number_to_string` | FACT | |
| Non-finite REJECTED. | Both | FACT / TESTED | Diverges from `JSON.stringify` default. |
| `-0` → `"0"`. | Both | FACT / TESTED | |
| 14 reference vectors cross-checked. | `numericCanonicalization.test.mjs`, `test_numeric_canonicalization.py` | TESTED | See coverage gaps below. |
| No coverage for subnormals, 2^53 boundary, e-notation interior crossovers. | — | AMBIGUITY | |
| Python `int` path (`str(n)`) allows arbitrary precision; JS `Number` cannot. | `aura_verify.py#canonicalize` | ASSUMPTION | Producer-side risk. |
| **Blocking decision:** **P-002**. |  |  |  |

### 3.5 Hash domain (P-003)

| Surface | Location | Tag | Note |
|---|---|---|---|
| Algorithm: SHA-256 over UTF-8 bytes of canonical string. | `sha256Hex`, `sha256_hex` | FACT | |
| Digest encoding: lowercase hex, no separators. | JS `padStart(2,"0")`, Python `hexdigest()` | FACT | Not asserted by fixture. |
| No wire-level `hash_algorithm` field. | Envelope | FACT | Migration would require version bump. |
| **Blocking decision:** **P-003**. |  |  |  |

### 3.6 Chain semantics (P-004)

| Surface | Location | Tag | Note |
|---|---|---|---|
| `chain_hash[i] = SHA-256( ascii(prev_hex[i]) ‖ ascii(canonical_hash_hex[i]) )`. | Both | FACT | **Textual** hex-string concatenation. |
| Genesis anchor `prev_hash[0]` = 64 ASCII `"0"`. | Both | FACT / TESTED | Part of chain semantics (no separate canonical P-ID for genesis). |
| Verifier uses **re-derived** `chain_hash[i-1]` as expected `prev[i]` — cascade. | `verifySession` (JS); `run_suite` (Python) | FACT / TESTED | Cross-references P-010. |
| Mutation of any record cascades to every subsequent record. | Emergent | ASSUMPTION | Not enumerated as a test vector. |
| Textual vs raw-byte concatenation not stated normatively. | Docs | AMBIGUITY | |
| **Blocking decision:** **P-004** (with P-010 for stored-vs-re-derived). |  |  |  |

### 3.7 Policy binding (P-007)

| Surface | Location | Tag | Note |
|---|---|---|---|
| `decision.policy_version` MUST be truthy AND ∈ `session.registered_policy_versions`. | Both | FACT / TESTED | |
| Comparator = strict identity (`===` / `in`). | Both | FACT | No semver / normalisation. |
| No content-hash binding of policy body. | — | AMBIGUITY | |
| **Blocking decision:** **P-007**. |  |  |  |

### 3.8 Verification result semantics (P-008)

| Surface | Location | Tag | Note |
|---|---|---|---|
| Statuses: `PASS`, `FAIL`, `NOT IMPLEMENTED`, `NOT APPLICABLE`. | `conformanceCore.STATUS`, `aura_verify.py` | FACT | |
| Overall = FAIL if any FAIL; else PASS if every test ∈ {PASS, NI, NA}; else FAIL. | `runConformanceSuite`, `run_suite` | FACT / TESTED | |
| Empty-bundle short-circuit: Node emits ONE test (`impl:evidence-structure = FAIL`); Python emits FULL 10-test table. | Both | AMBIGUITY | Cross-impl mismatch. |
| Runtime tamper-detection probe (INV-TMP-01) provides evidence that the verifier actually detects mutation. | `tamperProbe`, `tamper_probe` | FACT / TESTED | |
| Whether `NOT IMPLEMENTED` should fold to FAIL in overall is unresolved. | Docs | AMBIGUITY | |
| **Blocking decision:** **P-008**. |  |  |  |

### 3.9 Versioning (P-009)

| Surface | Location | Tag | Note |
|---|---|---|---|
| `PROTOCOL_VERSION = "unspecified"` in both impls. | `conformanceCore.js`, `aura_verify.py` | FACT | |
| `BUNDLE_VERSION = 1`. | Both | FACT | Integer, no SemVer. |
| `verifier_version` per impl: `aura-guard-conformance-core/0.3.0`, `aura-verify-py/0.3.0`. | Both | FACT | |
| `binding_matrix_version`: JS `"1.3"` vs Python hard-coded `"1.2"`. | `bindingMatrix.js`, `aura_verify.py` | AMBIGUITY | Governance sub-question — whether the matrix version is a normative field is itself Owner-decision. |
| **Blocking decision:** **P-009**. |  |  |  |

### 3.10 Evidence boundary (P-010)

| Surface | Location | Tag | Note |
|---|---|---|---|
| Verifier RE-DERIVES `canonical`, `canonical_hash`, `chain_hash` from payload and compares to stored evidence. | `verifyDecision`, `verify_decision` | FACT / TESTED | Re-derivation is authoritative. |
| Stored `evidence.canonical_representation` is documented as "implementation-defined, pending normative Aura specification". | `BUNDLE_SCHEMA.md` | ASSUMPTION | Whether storage is REQUIRED / OPTIONAL / FORBIDDEN is unresolved. |
| Stored `prev_hash[i]` is compared to the **re-derived** `chain_hash[i-1]`. | `verifySession` (JS) `prev = r.recomputedChain`; Python mirrors. | FACT | |
| Portability: independent verifier can verify without mutating the bundle file. | Node CLI + Python CLI + `portability.test.mjs` | FACT / TESTED | Cross-references P-011. |
| Attestation payload uses **re-derived** final chain hash, not stored. | `deriveFinalChainHash → verifySession` | FACT | Ties attestation to re-derived truth. |
| **Blocking decision:** **P-010** (with P-004 on the cascade branch). |  |  |  |

### 3.11 Cross-implementation semantics (P-011)

| Surface | Location | Tag | Note |
|---|---|---|---|
| Node CLI spawns Python (`spawnSync`) with the same bundle file. | `aura-verify.mjs#runCrossImpl` | FACT | Implementation evidence only; not normative. |
| Agreement = per-`(id, status)` equality on common ids minus `impl:cross-implementation`. | `aura-verify.mjs#agreementFrom` | FACT | |
| Absent second implementation → `NOT APPLICABLE`. | Both | FACT / TESTED | |
| Python always emits `impl:cross-implementation = NOT IMPLEMENTED`. | `aura_verify.py#run_suite` | FACT | Direction is asymmetric. |
| `id`-based join is fragile to rename in either impl. | — | AMBIGUITY | |
| **Blocking decision:** **P-011**. |  |  |  |

### 3.12 Error / malformed-input semantics (P-012)

| Surface | Location | Tag | Note |
|---|---|---|---|
| CLI exit codes: `0 PASS · 1 FAIL · 2 bad input`. | `aura-verify.mjs`, `aura_verify.py` | FACT / TESTED | Both impls. |
| Attestation emits closed-set codes (`unknown_key`, `revoked_key`, `algorithm_mismatch`, `unsupported_version`, `unsupported_algorithm`, `malformed_attestation`, `bad_timestamp`, `out_of_window`, `payload_mismatch`, `verify_error`, `bad_signature`). | `attestation.js`, `aura_verify.py` | FACT | Cross-impl compare only checks status, not codes. |
| Non-attestation tests emit free-form `message`; no code. | Both | AMBIGUITY | |
| Non-finite number rejection: JS `Error` vs Python `ValueError`; messages identical. | `canonicalNumber.js`, `aura_verify.py#_js_number_to_string` | AMBIGUITY | Different exception class. |
| Bundle-level malformation exits 2 with plain stderr text (no structured error object). | Both CLIs | AMBIGUITY | |
| **Blocking decision:** **P-012**. |  |  |  |

### 3.13 Attestation surfaces (DEFERRED / CANDIDATE P-013)

Attestation is **NOT** part of P-001 … P-012 in this correction. It
remains **DEFERRED / NON-NORMATIVE**. Facts captured here for
completeness only; they DO NOT create canonical decisions.

| Surface | Location | Tag |
|---|---|---|
| Algorithm: Ed25519 (RFC 8032). | `attestation.js`, `ed25519_ref.py` | FACT |
| 10-field canonical signed payload. | `buildAttestationPayload`, `_build_attestation_payload` | FACT |
| Trusted registry is out-of-band. | `signingKeys.js`, `/app/config/signing_keys.json` | FACT |
| Revocation is retroactive; `retired` is documented but unenforced. | Docs + code | AMBIGUITY |
| `aura-sign.mjs` overwrites any existing `attestation` block. | `aura-sign.mjs` | FACT |
| Signature is verified over the RECEIVED `signed_payload` string after byte-equality check to re-derived canonical form. | `verifyAttestation`, `verify_attestation` | FACT |

### 3.14 Timestamp surfaces (DISCOVERED / CROSS-CUTTING)

Not assigned a canonical P-ID. Dependencies noted:

| Surface | Location | Tag | Depends on |
|---|---|---|---|
| Verifiers parse via JS `Date.parse` (permissive) or Python `datetime.fromisoformat` with `Z→+00:00` shim. | `attestation.js`, `aura_verify.py#_iso_to_ts` | ASSUMPTION | P-001 (canonicalization of timestamp bytes inside a payload), P-010 (timestamp in evidence), CANDIDATE P-013 (attestation `signed_at`). |
| No verifier rejects offset ≠ `Z` or missing offset. | Both | AMBIGUITY | Same. |

## 4. What was NOT changed

- No `.js`, `.mjs`, `.py`, or JSON file under `/app/frontend/src/lib/`,
  `/app/cli/`, `/app/py_verifier/`, `/app/frontend/tests/`,
  `/app/py_verifier/tests/`, or `/app/config/` was modified.
- No new source module was added.
- No test fixtures were added or amended.
- `binding_matrix.json` was NOT modified even though the drift between
  it and `aura_verify.py` (`1.3` vs `1.2`) is a real ambiguity — that
  is now tracked as A-012 pending Owner ruling on P-009.

## 5. Normative status of this document

**NON-NORMATIVE.** This inventory records *observed* implementation
behavior. Any statement herein becomes normative only if adopted
verbatim by the Protocol Owner and referenced from an Aura Protocol
version that is no longer `"unspecified"`.
