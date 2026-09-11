# PHASE 3 — SEMANTIC INVENTORY

**Status:** ANALYSIS ARTIFACT · NON-NORMATIVE · READ-ONLY
**protocol_version:** `unspecified`
**Source of truth:** current implementation code as of this analysis. No code was changed to produce this document.

This inventory enumerates every semantic surface an Aura verifier currently
depends on — the raw material the Protocol Owner needs to make normative
decisions before the Aura Protocol can be frozen.

Every row is tagged with one of:

| Tag | Meaning |
|---|---|
| **FACT** | Implementation fact directly observed in source. |
| **TESTED** | Behavior asserted by a test in this repository. |
| **ASSUMPTION** | Implementation assumption the code depends on but does not state normatively. |
| **AMBIGUITY** | Behavior is currently under-specified; another conforming implementation could legally diverge. |
| **INV-CANDIDATE** | Architectural invariant candidate for the future normative spec. |
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

- **Verification (Node):** `aura-verify.mjs → runConformanceSuite → verifySession → verifyDecision → canonicalize + sha256Hex`, then cross-impl spawn to `py_verifier/aura_verify.py`.
- **Verification (Python):** `aura_verify.main → validate_bundle → run_suite → verify_decision → canonicalize + sha256_hex`, and `check_attestation → verify_attestation → ed25519_ref.verify`.
- **Signing (Node CLI):** `aura-sign.mjs → buildAttestationPayload → canonicalPayloadString → Node `crypto.sign(null, …, ed25519PrivateKey)` → attach `attestation` block`.
- **Chain re-derivation for attestation:** `attestation.js#deriveFinalChainHash → verifySession → recomputedChain` (uses *re-derived* chain, not stored `chain_hash`).
- **Tamper probe:** `conformanceCore.tamperProbe → deep clone → mutate `.reason` → verifyDecision on clone → expect `canonical_representation:false && sha256_integrity:false`.

## 3. Semantic surfaces (canonical enumeration)

### 3.1 Bundle envelope

| Surface | Location | Tag | Note |
|---|---|---|---|
| `bundle_version === 1` accepted by both verifiers. | `exportBundle.js`, `aura-verify.mjs#validateBundle`, `aura_verify.py#validate_bundle` | FACT / TESTED | Any other value is rejected with exit 2. |
| `exported_at`, `source`, `note` fields carried in envelope. | `exportBundle.js` | FACT | Not part of verification. |
| `session` is a passthrough of the imported session shape (extra keys tolerated). | `exportBundle.js`, `BUNDLE_SCHEMA.md` | FACT | Extra top-level `session` fields are neither validated nor forbidden. |
| Are unknown `session.*` keys legal? Are they part of canonicalization? | — | AMBIGUITY | Currently unknown keys DO participate in canonicalization of decisions only if they live inside the decision object; envelope fields are not canonicalized because the payload = decision minus `evidence`. |

### 3.2 Decision payload (canonicalized subject)

| Surface | Location | Tag | Note |
|---|---|---|---|
| Payload = `{...decision}` minus the `evidence` key. | `verification.js#decisionPayload`, `aura_verify.py#_payload` | FACT | Exact set of *other* keys is not fixed by a schema. |
| Any set of extra keys inside `decision` is canonicalized as-is. | `verification.js#canonicalize`, `aura_verify.py#canonicalize` | FACT | Extensibility is de-facto open. |
| No schema forbids unknown keys (only `id` + `evidence` are required). | `BUNDLE_SCHEMA.md` | AMBIGUITY | Open-world vs closed-world extension is undefined. |

### 3.3 Canonicalization

| Surface | Location | Tag | Note |
|---|---|---|---|
| Object keys are sorted **lexicographically by JS `String#sort`** and Python `sorted(keys)`. | `verification.js` / `aura_verify.py` | FACT | Both use codepoint order for ASCII keys; behavior for non-ASCII keys is claimed equal but not tested. |
| Arrays preserved in-order. | Both | FACT / TESTED | Order is treated as semantic. |
| No whitespace. | Both | FACT | JCS-lite. |
| Strings encoded via `JSON.stringify` (JS) and `json.dumps(v, ensure_ascii=False)` (Python). | `verification.js`, `aura_verify.py` | FACT | Both produce `\uXXXX` for controls; both leave non-ASCII chars raw. This is **assumed equivalent**; escape-set equality across Unicode has **not** been proven byte-for-byte in tests. |
| `null` → `"null"`; booleans → `"true"/"false"`. | Both | FACT | |
| Numbers → INV-FLT-01 (see §3.4). | `canonicalNumber.js`, `aura_verify.py#_js_number_to_string` | FACT / TESTED | 14 reference vectors. |
| Only JSON-scalar / array / object types accepted; anything else throws. | Both | FACT | JS throws for `undefined`, symbols; Python throws for non-JSON types. |
| Are integer JSON tokens vs JS `number` conflated? | `verification.js` treats all numbers via `canonicalNumberString`; Python differentiates `int` (str(n)) vs `float`. | ASSUMPTION | For values ≤ MAX_SAFE_INTEGER the two paths coincide; larger `int` in Python is not exercised. |
| Are keys allowed to contain U+0000 or unpaired surrogates? | Neither implementation guards. | AMBIGUITY | RFC 8785 would restrict; current impl relies on `JSON.stringify` / `json.dumps` defaults, which differ on surrogates. |

### 3.4 Numeric canonicalization (INV-FLT-01)

| Surface | Location | Tag | Note |
|---|---|---|---|
| Rule = ECMAScript §6.1.6.1.13 `Number::toString`. | `INV_FLT_01_...md`, `canonicalNumber.js`, `_js_number_to_string` | FACT | |
| `NaN` / `±Infinity` REJECTED. | Both | FACT / TESTED | Diverges from `JSON.stringify` default (which emits `null`). |
| `-0` → `"0"`. | Both | FACT / TESTED | |
| Cross-impl vectors tested. | `numericCanonicalization.test.mjs`, `test_numeric_canonicalization.py` | TESTED | 14 vectors only. |
| Vectors do not cover: subnormals, ±smallest normal, 2^53±1, IEEE-754 boundary transitions, e-notation crossover interior (e.g. 9.999e20). | — | AMBIGUITY | Coverage gap; a conforming re-implementation could diverge on untested values. |

### 3.5 Hashing

| Surface | Location | Tag | Note |
|---|---|---|---|
| Algorithm: `SHA-256` over UTF-8 bytes of the canonical string. | `verification.js#sha256Hex`, `aura_verify.py#sha256_hex` | FACT | |
| Digest encoding: **lowercase hex** without separators. | JS: `padStart(2,"0")`; Python: `hashlib.sha256().hexdigest()` (lowercase). | FACT | Uppercase or base64 would fail. Not asserted in a fixture. |

### 3.6 Hash chain

| Surface | Location | Tag | Note |
|---|---|---|---|
| `chain_hash[i] = sha256Hex(prev[i] ‖ canonical_hash[i])` where `‖` is **string concatenation of hex strings**. | Both | FACT | Not raw-byte concatenation. |
| `prev[0] = "0" × 64` (64 ASCII zeros). | Both | FACT / TESTED | |
| Verifier uses **re-derived** previous `chain_hash` as the expected `prev` for the next record (cascade semantics). | `verification.js#verifySession`: `prev = r.recomputedChain`. Python mirrors. | FACT / TESTED | Chosen so any mutation cascades. |
| Behavior when a record's stored `prev_hash` disagrees with the previous *stored* `chain_hash` but agrees with the *re-derived* one (or vice-versa) is not enumerated as a distinct case. | — | AMBIGUITY | Cascade behavior is emergent, not stated. |

### 3.7 Policy binding

| Surface | Location | Tag | Note |
|---|---|---|---|
| `decision.policy_version` MUST be truthy AND ∈ `session.registered_policy_versions`. | Both | FACT / TESTED | |
| Case sensitivity, whitespace normalisation, ordering, and semantic-version compatibility are NOT defined. | — | AMBIGUITY | Match is strict `===` / `in`. |
| No mechanism to bind a decision to a *content hash* of the policy, only its identifier. | — | AMBIGUITY | Trust the identifier alone. |

### 3.8 Attestation

| Surface | Location | Tag | Note |
|---|---|---|---|
| Algorithm: Ed25519 (RFC 8032). | `attestation.js`, `ed25519_ref.py`, `INV_ATT_01...md` | FACT | |
| Canonical signed payload has the exact 10 fields listed in `INV_ATT_01_...md` §"Canonical signed payload". | `attestation.js#buildAttestationPayload`, `aura_verify.py#_build_attestation_payload` | FACT | |
| `registered_policy_versions` inside the signed payload is **lex-sorted**. | Same. | FACT | Comparator = default `Array.prototype.sort` (JS) / `sorted()` (Python). Byte-identity across implementations is assumed. |
| `final_chain_hash` uses the **re-derived** chain, not the stored one. | `deriveFinalChainHash → verifySession`. | FACT | Ties attestation to re-derived truth. |
| Trusted registry is out-of-band (never inside the bundle). | `signingKeys.js`, `/app/config/signing_keys.json` | FACT | JS mirrors JSON file. |
| Revocation is **retroactive** in v1. | `INV_ATT_01_...md` §Lifecycle rules item 2. | FACT | Documented but marked as "conservative default; future spec MAY split revocation from retirement". |
| Signature is over **UTF-8(signed_payload)** — i.e. the string, not a re-canonicalization. | `attestation.js#signAttestation`, `verify_attestation` | FACT | The signer's canonicalization becomes the source of truth on the wire. |
| Are timestamps required strictly RFC 3339 with `Z`? | JS uses `Date.parse` (permissive); Python uses `datetime.fromisoformat` with a `Z→+00:00` shim. | ASSUMPTION | Both accept broader ISO-8601. |
| Attestation status codes: `unsupported_version`, `unsupported_algorithm`, `malformed_attestation`, `unknown_key`, `revoked_key`, `algorithm_mismatch`, `bad_timestamp`, `out_of_window`, `payload_mismatch`, `verify_error`, `bad_signature`. | `attestation.js`, `aura_verify.py` | FACT | Ordering of code checks (short-circuit sequence) is currently identical across impls. |
| No key-rollover / retired-status test path present. | — | AMBIGUITY | `retired` status is described in doc but not enforced by either verifier's code (Python code only checks `revoked`; JS code only checks `revoked`). |

### 3.9 Cross-implementation check (INV-XIM-01)

| Surface | Location | Tag | Note |
|---|---|---|---|
| Node CLI spawns Python with the same bundle path (`spawnSync`). | `aura-verify.mjs#runCrossImpl` | FACT | |
| Agreement = per-test-status equality on **common ids** minus `impl:cross-implementation` itself. | `aura-verify.mjs#agreementFrom` | FACT | |
| Absent second implementation → `NOT APPLICABLE` (not FAIL). | Both | FACT / TESTED | |
| Python side ALWAYS emits `impl:cross-implementation = NOT IMPLEMENTED`. | `aura_verify.py#run_suite` tests table | FACT | Cross-impl is one-directional in-runtime (Node calls Python, never inverse). |
| `binding_matrix_version` value differs: JS reports `"1.3"`, Python hard-codes `"1.2"`. | `bindingMatrix.js`, `aura_verify.py` | AMBIGUITY | Documented as ambiguity in Register (P-009). |

### 3.10 CLI contract & error semantics

| Surface | Location | Tag | Note |
|---|---|---|---|
| Exit codes: `0 PASS · 1 FAIL · 2 bad input`. | `aura-verify.mjs#usage`, `aura_verify.py#main` | FACT / TESTED | Documented identically. |
| `--json` flag emits JSON suite to stdout; human form otherwise. | Both CLIs | FACT | JSON schema is implicit (no schema document). |
| Python `--json` output omits per-test `label`, `message`, `invariant_id`, `requirement_ids`; Node output includes them. | `aura_verify.py#run_suite` vs `conformanceCore.js#annotate` | AMBIGUITY | Cross-impl comparator only compares `id` + `status`. |

### 3.11 Reporting / suite shape

| Surface | Location | Tag | Note |
|---|---|---|---|
| Statuses: `PASS`, `FAIL`, `NOT IMPLEMENTED`, `NOT APPLICABLE`. | `conformanceCore.js#STATUS`, `aura_verify.py` | FACT | |
| Overall = FAIL if any FAIL; else PASS if every test is one of {PASS, NOT IMPLEMENTED, NOT APPLICABLE}; else FAIL. | `conformanceCore.js#runConformanceSuite` | FACT | |
| Empty bundle short-circuit: emit only `impl:evidence-structure = FAIL`. | `conformanceCore.js` | FACT / TESTED | |
| Meta fields: `protocol_version`, `verifier_version`, `bundle_version`, `binding_matrix_version`, `record_count`. | Both suites | FACT | JS also includes `run_at`. |

### 3.12 Attestation signer (write-side)

| Surface | Location | Tag | Note |
|---|---|---|---|
| `aura-sign.mjs` mutates the bundle file by attaching `attestation`. | `aura-sign.mjs` writeFileSync | FACT | No pre-existing `attestation` check; will silently overwrite. |
| PKCS8 wrapping of raw 32-byte seed for Node `createPrivateKey`. | Same. | FACT | Constant OID prefix `302e020100300506032b657004220420`. |
| Signed payload string used verbatim as `signed_payload` (verifier does not re-canonicalize the *received* string; it re-canonicalizes from bundle and compares bytes). | Same. | FACT | Intentional: canonicalizer bugs in the signer would be caught by verifier. |

## 4. Discovered additional domains (candidate P-013+ — non-normative)

These were surfaced while inspecting code. **Not** promoted into P-001…P-012 unless the Owner elects to.

- **P-013 (candidate) — Attestation semantics governance.** Ed25519 pinning, key registry structure, revocation retroactivity, `retired` semantics gap (see §3.8). Currently spec'd in `INV_ATT_01_...md` but neither invariant is normative.
- **P-014 (candidate) — Verifier state & replay/idempotency.** Does re-running the verifier on the same file MUST be a pure function? Currently it is by inspection, but not asserted.
- **P-015 (candidate) — Policy-version semantics.** Comparison rule (identity vs semver vs content-hash) is unspecified.
- **P-016 (candidate) — Cascade / prev-hash source semantics.** Verifier uses re-derived `chain_hash[i-1]` as expected `prev[i]`. An alternative "trust stored prev" reading is legal by the wire schema.
- **P-017 (candidate) — Bundle envelope openness.** Extra top-level or session-level keys: ignored, forbidden, or normatively defined?

## 5. What was NOT changed

- No `.js`, `.mjs`, `.py`, or JSON file under `/app/frontend/src/lib/`, `/app/cli/`, `/app/py_verifier/`, `/app/frontend/tests/`, `/app/py_verifier/tests/`, or `/app/config/` was modified.
- No new source module was added.
- No test fixtures were added or amended.

## 6. Normative status of this document

**NON-NORMATIVE.** This inventory records *observed* implementation behavior. Any statement herein becomes normative only if adopted verbatim by the Protocol Owner and referenced from an Aura Protocol version that is no longer `"unspecified"`.
