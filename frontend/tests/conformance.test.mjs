/**
 * Negative-scenario regression tests for the Conformance Core.
 *
 * Run: node --test /app/frontend/tests/conformance.test.mjs
 *
 * A tamper-detection test is PASS iff the verifier correctly detects
 * invalid evidence. Silently accepting tampered evidence is a test FAIL.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const { buildHashChain } = await import("../src/lib/verification.js");
const { runConformanceSuite, STATUS, PROTOCOL_VERSION, VERIFIER_VERSION } =
    await import("../src/lib/conformanceCore.js");

const REGISTERED = new Set(["policy-A", "policy-B"]);

async function freshChain() {
    return buildHashChain([
        { id: "D-1", timestamp: "t1", action: "a", policy_version: "policy-A", policy_status: "compliant", reason: "ok", input: {}, output: {} },
        { id: "D-2", timestamp: "t2", action: "a", policy_version: "policy-A", policy_status: "warning", reason: "ok", input: {}, output: {} },
        { id: "D-3", timestamp: "t3", action: "a", policy_version: "policy-B", policy_status: "compliant", reason: "ok", input: {}, output: {} },
    ]);
}

test("clean bundle → overall PASS with expected meta", async () => {
    const decisions = await freshChain();
    const s = await runConformanceSuite({ decisions, registeredPolicies: REGISTERED });
    assert.equal(s.overall, STATUS.PASS);
    assert.equal(s.protocol_version, PROTOCOL_VERSION);
    assert.equal(s.verifier_version, VERIFIER_VERSION);
    assert.ok(s.tests.some((t) => t.id === "impl:tamper-detection" && t.status === STATUS.PASS));
    // NOT-IMPLEMENTED items must be explicit.
    const ni = s.tests.find((x) => x.id === "impl:cross-implementation");
    assert.equal(ni.status, STATUS.NOT_IMPLEMENTED, "impl:cross-implementation must be NOT IMPLEMENTED");
    // Evidence portability is now PASS (verified independently by the CLI).
    assert.equal(
        s.tests.find((x) => x.id === "impl:evidence-portability").status,
        STATUS.PASS
    );
    // impl:attestation-signature is NOT APPLICABLE on a bundle without an
    // attestation block (INV-ATT-01 v1.0). Cross-implementation stays NI.
    assert.equal(
        s.tests.find((x) => x.id === "impl:attestation-signature").status,
        STATUS.NOT_APPLICABLE
    );
    assert.equal(
        s.tests.find((x) => x.id === "impl:cross-implementation").status,
        STATUS.NOT_IMPLEMENTED
    );
});

test("negative: normal field mutation (reason) → tamper detected", async () => {
    const decisions = await freshChain();
    decisions[0] = { ...decisions[0], reason: "TAMPERED" };
    const s = await runConformanceSuite({ decisions, registeredPolicies: REGISTERED });
    assert.equal(s.overall, STATUS.FAIL);
    assert.equal(s.tests.find((t) => t.id === "impl:hash-integrity").status, STATUS.FAIL);
});

test("negative: policy_version mutation → policy binding FAIL and integrity FAIL", async () => {
    const decisions = await freshChain();
    decisions[0] = { ...decisions[0], policy_version: "policy-UNREGISTERED" };
    const s = await runConformanceSuite({ decisions, registeredPolicies: REGISTERED });
    assert.equal(s.overall, STATUS.FAIL);
    assert.equal(s.tests.find((t) => t.id === "impl:policy-binding").status, STATUS.FAIL);
    assert.equal(s.tests.find((t) => t.id === "impl:hash-integrity").status, STATUS.FAIL);
});

test("negative: canonical_hash mutation → integrity FAIL", async () => {
    const decisions = await freshChain();
    decisions[0] = {
        ...decisions[0],
        evidence: { ...decisions[0].evidence, canonical_hash: "0".repeat(64) },
    };
    const s = await runConformanceSuite({ decisions, registeredPolicies: REGISTERED });
    assert.equal(s.tests.find((t) => t.id === "impl:hash-integrity").status, STATUS.FAIL);
});

test("negative: prev_hash mutation → chain continuity FAIL", async () => {
    const decisions = await freshChain();
    decisions[1] = {
        ...decisions[1],
        evidence: { ...decisions[1].evidence, prev_hash: "f".repeat(64) },
    };
    const s = await runConformanceSuite({ decisions, registeredPolicies: REGISTERED });
    assert.equal(s.tests.find((t) => t.id === "impl:chain-continuity").status, STATUS.FAIL);
});

test("negative: chain_hash mutation → chain continuity FAIL", async () => {
    const decisions = await freshChain();
    decisions[1] = {
        ...decisions[1],
        evidence: { ...decisions[1].evidence, chain_hash: "a".repeat(64) },
    };
    const s = await runConformanceSuite({ decisions, registeredPolicies: REGISTERED });
    assert.equal(s.tests.find((t) => t.id === "impl:chain-continuity").status, STATUS.FAIL);
});

test("negative: required id removal → evidence structure FAIL", async () => {
    const decisions = await freshChain();
    // eslint-disable-next-line no-unused-vars
    const { id, ...rest } = decisions[0];
    decisions[0] = rest;
    const s = await runConformanceSuite({ decisions, registeredPolicies: REGISTERED });
    assert.equal(s.tests.find((t) => t.id === "impl:evidence-structure").status, STATUS.FAIL);
});

test("negative: record reordering → hash-chain continuity FAIL (cascade)", async () => {
    const decisions = await freshChain();
    // Swap rows 1 and 2 without recomputing evidence.
    [decisions[1], decisions[2]] = [decisions[2], decisions[1]];
    const s = await runConformanceSuite({ decisions, registeredPolicies: REGISTERED });
    assert.equal(s.tests.find((t) => t.id === "impl:chain-continuity").status, STATUS.FAIL);
});

test("empty bundle → overall FAIL, evidence-structure FAIL", async () => {
    const s = await runConformanceSuite({ decisions: [], registeredPolicies: REGISTERED });
    assert.equal(s.overall, STATUS.FAIL);
    assert.equal(s.tests[0].id, "impl:evidence-structure");
    assert.equal(s.tests[0].status, STATUS.FAIL);
});
