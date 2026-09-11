/**
 * INV-FLT-01 — Numeric canonicalization tests.
 *
 * Locks the JS side to the spec in /app/docs/INV_FLT_01_NUMERIC_CANONICALIZATION.md.
 * Cross-implementation parity with the Python verifier is enforced separately
 * by /app/py_verifier/tests/test_numeric_canonicalization.py.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const { canonicalize } = await import("../src/lib/verification.js");
const { canonicalNumberString, CANONICAL_NUMBER_VECTORS } = await import("../src/lib/canonicalNumber.js");
const { runConformanceSuite, STATUS } = await import("../src/lib/conformanceCore.js");
const { buildHashChain } = await import("../src/lib/verification.js");

test("INV-FLT-01: every reference vector serializes to the expected string", () => {
    for (const { input, expected } of CANONICAL_NUMBER_VECTORS) {
        assert.equal(canonicalNumberString(input), expected,
            `canonicalNumberString(${String(input)}) → ${expected}`);
    }
});

test("INV-FLT-01: canonicalize() routes numbers through canonicalNumberString", () => {
    for (const { input, expected } of CANONICAL_NUMBER_VECTORS) {
        assert.equal(canonicalize(input), expected);
    }
});

test("INV-FLT-01: NaN, +Infinity, -Infinity are REJECTED (canonicalizer throws)", () => {
    assert.throws(() => canonicalNumberString(NaN),        /INV-FLT-01/);
    assert.throws(() => canonicalNumberString(Infinity),   /INV-FLT-01/);
    assert.throws(() => canonicalNumberString(-Infinity),  /INV-FLT-01/);
    assert.throws(() => canonicalize(NaN),                 /INV-FLT-01/);
    assert.throws(() => canonicalize({ x: Infinity }),     /INV-FLT-01/);
});

test("INV-FLT-01: -0 and +0 both serialize to '0' (round-trip stable)", () => {
    assert.equal(canonicalNumberString(-0), "0");
    assert.equal(canonicalNumberString(0),  "0");
    assert.equal(canonicalize({ v: -0 }), '{"v":0}');
});

test("INV-FLT-01: integer-valued floats collapse (640.0 → '640', 1.0 → '1')", () => {
    // Regression guard for the exact case that used to fragilely rely on JS
    // JSON.stringify collapsing but silently break if a Python-produced bundle
    // was verified by JS.
    assert.equal(canonicalize(640.0), "640");
    assert.equal(canonicalize(1.0),   "1");
    assert.equal(canonicalize([1.0, 640.0, 128.4]), "[1,640,128.4]");
});

test("INV-FLT-01: conformance suite emits impl:numeric-canonicalization = PASS on clean bundle", async () => {
    const chained = await buildHashChain([
        { id: "N-1", policy_version: "policy-A", input: { amount: 128.4, tiny: 1e-7, big: 1e21 }, output: { risk: 0.11 } },
    ]);
    const s = await runConformanceSuite({ decisions: chained, registeredPolicies: new Set(["policy-A"]) });
    const t = s.tests.find((x) => x.id === "impl:numeric-canonicalization");
    assert.ok(t, "impl:numeric-canonicalization must be emitted");
    assert.equal(t.status, STATUS.PASS);
    assert.equal(t.invariant_id, "INV-FLT-01");
    assert.deepEqual(t.requirement_ids, ["REQ-FLT-01"]);
});
