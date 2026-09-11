# INV-FLT-01 — Numeric Canonicalization Rule (v1.0)

**IMPLEMENTATION-LEVEL, NON-NORMATIVE — PENDING AURA PROTOCOL SPECIFICATION**

Binding matrix row: `INV-FLT-01` (see `binding_matrix.json`).
Requirement: `REQ-FLT-01`.
Executable check: `impl:numeric-canonicalization` → `checkNumericCanonicalization`.

## Purpose

Deliver **bit-exact** cross-implementation agreement on how JSON numbers are
serialized inside the canonical representation, so that the JS canonicalizer
(`/app/frontend/src/lib/verification.js`) and the Python canonicalizer
(`/app/py_verifier/aura_verify.py`) can never produce different bytes for the
same IEEE-754 double.

## Normative rule

Numeric values MUST be serialized using **ECMAScript 2020 §6.1.6.1.13
`Number::toString`**, henceforth **ES-NumberToString**. Equivalent statement:

Let `m` be a finite IEEE-754 double.

1. **Rejected inputs.** `NaN`, `+Infinity`, `-Infinity` are FORBIDDEN. The
   canonicalizer MUST throw. Encoding these as JSON `null` (as `JSON.stringify`
   does by default) is EXPLICITLY DISALLOWED because it silently corrupts
   evidence.
2. **Zero.** `+0` and `-0` both serialize to the string `"0"` (three-byte
   sequence `0x30`).
3. **Negative.** For `m < 0`, output `"-"` followed by the serialization of
   `-m`.
4. **Positive finite.** Compute the unique triple `(s, n, k)` of integers
   such that `k ≥ 1`, `10^(k-1) ≤ s < 10^k`, `s · 10^(n-k) = m`, and `k` is
   minimal. Then:
   - `k ≤ n ≤ 21` → `digits(s) ++ "0" × (n-k)`
   - `0 < n ≤ 21` → `digits(s)[0..n] ++ "." ++ digits(s)[n..k]`
   - `-6 < n ≤ 0` → `"0." ++ "0" × (-n) ++ digits(s)`
   - Otherwise, exponential form:
     - `k = 1` → `digits(s) ++ "e" ++ sign(n-1) ++ |n-1|`
     - `k > 1` → `digits(s)[0] ++ "." ++ digits(s)[1..k] ++ "e" ++ sign(n-1) ++ |n-1|`

   where `sign(x) = "+"` if `x ≥ 0` else `"-"`.

Integers (JSON tokens without `.` or `e/E`) are serialized by the equivalent
integer rule, which coincides with `str(n)` in Python and `String(n)` in JS.

## Reference vectors

| Input                                | Output                                     |
|--------------------------------------|--------------------------------------------|
| `0`                                  | `0`                                        |
| `-0`, `-0.0`                         | `0`                                        |
| `1`, `1.0`                           | `1`                                        |
| `-1`                                 | `-1`                                       |
| `0.1`                                | `0.1`                                      |
| `640.0`                              | `640`                                      |
| `128.4`                              | `128.4`                                    |
| `1e-6`                               | `0.000001`                                 |
| `1e-7`                               | `1e-7`                                     |
| `1e20`                               | `100000000000000000000`                    |
| `1e21`                               | `1e+21`                                    |
| `9007199254740991` (MAX_SAFE_INTEGER) | `9007199254740991`                        |
| `NaN`, `Infinity`, `-Infinity`       | *(FORBIDDEN — canonicalizer MUST throw)*   |

## Implementations

- **JS reference**: `String(n)` after finite-value gate. See
  `/app/frontend/src/lib/canonicalNumber.js`. `String(n)` is defined by the
  ECMAScript spec to be `Number::toString(n, 10)` — this rule is therefore
  natively supported by every conforming ECMAScript engine.
- **Python reference**: pure port of ES-NumberToString using Python's
  shortest round-trip `repr(float)` as the digit source. See
  `_js_number_to_string()` in `/app/py_verifier/aura_verify.py`.

## Compatibility with prior bundles

Existing sample bundles produced by the JS pipeline already used
`String(n)` semantics (via `JSON.stringify`), so their `canonical_hash` and
`chain_hash` values are unchanged. Python was previously fragile only because
`json.dumps(640.0)` emits `"640.0"` — that fragility is now fixed by routing
Python floats through `_js_number_to_string`. Integer inputs are unaffected.

## Enforcement

- Cross-implementation parity test: `/app/py_verifier/tests/test_numeric_canonicalization.py`.
- Node fixture test: `/app/frontend/tests/numericCanonicalization.test.mjs`.
- Runtime probe: `impl:numeric-canonicalization` in the Conformance Core.
- Non-finite rejection is validated on both sides.
