/**
 * Binding Matrix consistency tests (WP-1 / WP-2).
 *
 * Enforces the invariants that keep code ↔ matrix ↔ docs from drifting:
 *   1. The embedded matrix in /app/frontend/src/lib/bindingMatrix.js is
 *      structurally equal to /app/docs/binding_matrix.json.
 *   2. Every emitted test in a suite run carries a matrix invariant_id and
 *      non-empty requirement_ids EXCEPT declared-gap rows (never emitted).
 *   3. Every IMPLEMENTED matrix row has a corresponding check function that
 *      is exported by conformanceCore.js.
 *   4. Every emitted test id appears exactly once in the matrix.
 *   5. matrix_version is a non-empty string and status is implementation-level.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const { buildHashChain } = await import("../src/lib/verification.js");
const { BINDING_MATRIX } = await import("../src/lib/bindingMatrix.js");
const core = await import("../src/lib/conformanceCore.js");
const { runConformanceSuite, STATUS, BINDING_MATRIX_VERSION } = core;

const REGISTERED = new Set(["policy-A"]);

async function freshChain() {
    return buildHashChain([
        { id: "D-1", timestamp: "t1", action: "a", policy_version: "policy-A", policy_status: "compliant", reason: "ok", input: {}, output: {} },
        { id: "D-2", timestamp: "t2", action: "a", policy_version: "policy-A", policy_status: "compliant", reason: "ok", input: {}, output: {} },
    ]);
}

test("BINDING_MATRIX in code equals binding_matrix.json (row identity)", () => {
    const disk = JSON.parse(readFileSync("/app/docs/binding_matrix.json", "utf8"));
    assert.equal(BINDING_MATRIX.matrix_version, disk.matrix_version);
    assert.equal(BINDING_MATRIX.protocol_version, disk.protocol_version);
    assert.equal(BINDING_MATRIX.invariants.length, disk.invariants.length);
    for (let i = 0; i < disk.invariants.length; i++) {
        const a = BINDING_MATRIX.invariants[i];
        const b = disk.invariants[i];
        assert.equal(a.id, b.id, `row ${i} id`);
        assert.equal(a.impl_check_id, b.impl_check_id, `row ${i} impl_check_id`);
        assert.equal(a.check_function, b.check_function, `row ${i} check_function`);
        assert.deepEqual(a.requirement_ids, b.requirement_ids, `row ${i} requirement_ids`);
        assert.equal(a.status, b.status, `row ${i} status`);
    }
});

test("every IMPLEMENTED matrix row exports a matching check function", () => {
    for (const row of BINDING_MATRIX.invariants) {
        if (row.status !== "IMPLEMENTED") continue;
        assert.ok(row.check_function, `${row.id} must name a check_function`);
        assert.equal(typeof core[row.check_function], "function",
            `conformanceCore must export ${row.check_function} for ${row.id}`);
    }
});

test("every emitted test has invariant_id + requirement_ids from the matrix", async () => {
    const decisions = await freshChain();
    const s = await runConformanceSuite({ decisions, registeredPolicies: REGISTERED });
    for (const t of s.tests) {
        const row = BINDING_MATRIX.invariants.find((r) => r.impl_check_id === t.id);
        assert.ok(row, `test id ${t.id} must have a matrix row`);
        assert.equal(t.invariant_id, row.id, `${t.id} invariant_id must equal ${row.id}`);
        assert.deepEqual(t.requirement_ids, row.requirement_ids, `${t.id} requirement_ids`);
        assert.ok(t.requirement_ids.length > 0, `${t.id} must reference ≥1 requirement`);
    }
});

test("every emitted test id is unique and appears exactly once in the matrix", async () => {
    const decisions = await freshChain();
    const s = await runConformanceSuite({ decisions, registeredPolicies: REGISTERED });
    const seen = new Set();
    for (const t of s.tests) {
        assert.ok(!seen.has(t.id), `duplicate test id ${t.id}`);
        seen.add(t.id);
        const rows = BINDING_MATRIX.invariants.filter((r) => r.impl_check_id === t.id);
        assert.equal(rows.length, 1, `test id ${t.id} must appear exactly once in matrix`);
    }
});

test("suite meta exposes binding_matrix_version", async () => {
    const decisions = await freshChain();
    const s = await runConformanceSuite({ decisions, registeredPolicies: REGISTERED });
    assert.equal(s.binding_matrix_version, BINDING_MATRIX_VERSION);
    assert.equal(typeof BINDING_MATRIX_VERSION, "string");
    assert.ok(BINDING_MATRIX_VERSION.length > 0);
});

test("declared gaps (impl_check_id=null) are never emitted as tests", async () => {
    const decisions = await freshChain();
    const s = await runConformanceSuite({ decisions, registeredPolicies: REGISTERED });
    const gaps = BINDING_MATRIX.invariants.filter((r) => r.impl_check_id === null);
    for (const g of gaps) {
        assert.equal(g.status, "NOT_IMPLEMENTED", `${g.id} must be NOT_IMPLEMENTED to be a declared gap`);
        assert.ok(!s.tests.some((t) => t.invariant_id === g.id),
            `${g.id} is a declared gap and MUST NOT appear as an emitted test (would be a silent PASS risk)`);
    }
});

test("NOT_IMPLEMENTED matrix rows correspond to emitted NOT IMPLEMENTED tests", async () => {
    const decisions = await freshChain();
    const s = await runConformanceSuite({ decisions, registeredPolicies: REGISTERED });
    const runtimeNI = BINDING_MATRIX.invariants.filter(
        (r) => r.impl_check_id && (r.status === "NOT_IMPLEMENTED" || r.status === "NOT_IMPLEMENTED_AT_RUNTIME")
    );
    for (const r of runtimeNI) {
        const t = s.tests.find((x) => x.id === r.impl_check_id);
        assert.ok(t, `${r.id} must be emitted`);
        assert.equal(t.status, STATUS.NOT_IMPLEMENTED,
            `${r.id} (${r.impl_check_id}) must be emitted as NOT IMPLEMENTED, not ${t.status}`);
    }
});
