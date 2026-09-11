/**
 * INV-FLT-01 — Numeric canonicalization (v1.0).
 *
 * Rule (see /app/docs/INV_FLT_01_NUMERIC_CANONICALIZATION.md):
 *   - Reject NaN, +Infinity, -Infinity. Non-finite numbers in evidence
 *     silently corrupt hashes when serialized as JSON `null` (the default
 *     `JSON.stringify` behavior), so we throw instead.
 *   - Otherwise, use ECMAScript §6.1.6.1.13 Number::toString, which is
 *     natively `String(n)` in every conforming JS engine.
 *
 * The Python reference verifier ports this exact algorithm — the two sides
 * are bit-exact by construction.
 */

/**
 * Serialize a finite JS Number to the INV-FLT-01 canonical form.
 * Throws for NaN and ±Infinity.
 *
 * @param {number} n
 * @returns {string}
 */
export function canonicalNumberString(n) {
    if (typeof n !== "number" || !Number.isFinite(n)) {
        throw new Error(
            `INV-FLT-01: non-finite JSON numbers are forbidden (got ${String(n)})`
        );
    }
    // String(-0) === "0" per ECMAScript §6.1.6.1.13; that is the intended output.
    return String(n);
}

/**
 * Reference vectors — used by the runtime probe in the Conformance Core AND
 * by the cross-implementation parity test in Python. Any divergence between
 * this list and the Python side is a normative violation.
 */
export const CANONICAL_NUMBER_VECTORS = Object.freeze([
    { input: 0,                             expected: "0"                      },
    { input: -0,                            expected: "0"                      },
    { input: 1,                             expected: "1"                      },
    { input: 1.0,                           expected: "1"                      },
    { input: -1,                            expected: "-1"                     },
    { input: 0.1,                           expected: "0.1"                    },
    { input: 640.0,                         expected: "640"                    },
    { input: 128.4,                         expected: "128.4"                  },
    { input: 1e-6,                          expected: "0.000001"               },
    { input: 1e-7,                          expected: "1e-7"                   },
    { input: 1e20,                          expected: "100000000000000000000"  },
    { input: 1e21,                          expected: "1e+21"                  },
    { input: 9007199254740991,              expected: "9007199254740991"       },
    { input: -9007199254740991,             expected: "-9007199254740991"      },
]);
