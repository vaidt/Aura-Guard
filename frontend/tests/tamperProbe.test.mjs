/**
 * F3 remediation regression test.
 *
 * Proves that impl:tamper-detection is driven by the runtime probe, not by
 * v.allPass. Injects a fake "always PASS" verifier into tamperProbe and
 * asserts that the probe correctly reports detected=false — which would
 * flip impl:tamper-detection to FAIL in the suite.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const { buildHashChain } = await import("../src/lib/verification.js");
const { tamperProbe, runConformanceSuite, STATUS } = await import("../src/lib/conformanceCore.js");
const { SAMPLE_SESSION } = await import("../src/lib/sampleData.js");

test("F3: tamperProbe with real verifier detects deterministic mutation", async () => {
    const chained = await buildHashChain(SAMPLE_SESSION.decisions);
    const registered = new Set(SAMPLE_SESSION.registered_policy_versions);
    const r = await tamperProbe(chained, registered);
    assert.equal(r.ran, true);
    assert.equal(r.detected, true, "real verifier must detect the probe mutation");
    assert.equal(r.checks.sha256_integrity.pass, false);
    assert.equal(r.checks.canonical_representation.pass, false);
});

test("F3: tamperProbe with a BROKEN 'always-pass' verifier reports detected=false (regression guard)", async () => {
    const chained = await buildHashChain(SAMPLE_SESSION.decisions);
    const registered = new Set(SAMPLE_SESSION.registered_policy_versions);
    const alwaysPass = async () => ({
        pass: true,
        checks: {
            canonical_representation: { pass: true, label: "", detail: "" },
            sha256_integrity: { pass: true, label: "", detail: "" },
            hash_chain_continuity: { pass: true, label: "", detail: "" },
            policy_version: { pass: true, label: "", detail: "" },
        },
        recomputedHash: "0".repeat(64),
        recomputedChain: "0".repeat(64),
    });
    const r = await tamperProbe(chained, registered, alwaysPass);
    assert.equal(r.ran, true);
    assert.equal(r.detected, false,
        "if the verifier stopped detecting mutations, impl:tamper-detection would flip to FAIL");
});

test("F3: on a clean bundle, impl:tamper-detection is PASS (probe-driven, not v.allPass)", async () => {
    const chained = await buildHashChain(SAMPLE_SESSION.decisions);
    const s = await runConformanceSuite({
        decisions: chained,
        registeredPolicies: new Set(SAMPLE_SESSION.registered_policy_versions),
    });
    const t = s.tests.find((x) => x.id === "impl:tamper-detection");
    assert.equal(t.status, STATUS.PASS);
    assert.match(t.message, /Runtime probe/);
});

test("F3: on a tampered bundle, impl:tamper-detection remains PASS because the probe still runs on isolated clone", async () => {
    // Even if the live bundle is broken, the probe operates on an isolated
    // clone of decisions[0]; its detection capability is independent of the
    // live bundle's validity. Overall suite is FAIL (integrity fails), but
    // tamper-detection specifically asserts the verifier CAN detect tamper.
    const chained = await buildHashChain(SAMPLE_SESSION.decisions);
    chained[1] = { ...chained[1], reason: "TAMPERED" };
    const s = await runConformanceSuite({
        decisions: chained,
        registeredPolicies: new Set(SAMPLE_SESSION.registered_policy_versions),
    });
    assert.equal(s.overall, STATUS.FAIL);
    assert.equal(s.tests.find((t) => t.id === "impl:tamper-detection").status, STATUS.PASS);
    assert.equal(s.tests.find((t) => t.id === "impl:hash-integrity").status, STATUS.FAIL);
});
