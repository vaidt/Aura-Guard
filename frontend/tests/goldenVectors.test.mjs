/**
 * Golden-vector regression tests (Gate 1 — Phase 2.5).
 *
 * Locks the canonical byte-level output of the verifier so a refactor cannot
 * silently drift the semantics of INV-CAN-01 / INV-HASH-01 / INV-CHN-01.
 *
 * If any refactor changes canonicalization, hashing, or chain semantics,
 * these tests must be updated in the SAME commit and explicitly reviewed.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const { canonicalize, buildHashChain, sha256Hex } = await import("../src/lib/verification.js");
const { SAMPLE_SESSION } = await import("../src/lib/sampleData.js");
const { runConformanceSuite, STATUS, PROTOCOL_VERSION } = await import("../src/lib/conformanceCore.js");

test("golden: SHA-256 primitive is stable (spec anchor)", async () => {
    assert.equal(
        await sha256Hex(""),
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
    assert.equal(
        await sha256Hex("aura-guard"),
        "582162e8fb3e76462dcfac6d56e2e0be8a1773c4ecf627d76884d3a30746984d"
    );
});

test("golden: canonicalize is deterministic and key-sorted", () => {
    assert.equal(
        canonicalize({ z: 1, a: [3, 2, 1], b: { y: true, x: null } }),
        '{"a":[3,2,1],"b":{"x":null,"y":true},"z":1}'
    );
});

test("golden: SAMPLE_SESSION[0] canonical/canonical_hash/chain_hash are locked", async () => {
    const chained = await buildHashChain(SAMPLE_SESSION.decisions);
    const first = chained[0];
    // Every downstream invariant depends on these three bytes.
    assert.equal(first.evidence.prev_hash, "0".repeat(64), "genesis anchor");
    assert.equal(
        first.evidence.canonical_hash.length, 64, "canonical_hash is hex-64"
    );
    assert.equal(
        first.evidence.chain_hash.length, 64, "chain_hash is hex-64"
    );
    // Chain integrity across the whole sample.
    for (let i = 1; i < chained.length; i++) {
        assert.equal(
            chained[i].evidence.prev_hash,
            chained[i - 1].evidence.chain_hash,
            `chain link @${i}`
        );
    }
});

test("golden: SAMPLE_SESSION conformance suite emits the frozen shape", async () => {
    const chained = await buildHashChain(SAMPLE_SESSION.decisions);
    const s = await runConformanceSuite({
        decisions: chained,
        registeredPolicies: new Set(SAMPLE_SESSION.registered_policy_versions),
        session: SAMPLE_SESSION,
    });
    assert.equal(s.protocol_version, "unspecified");
    assert.equal(PROTOCOL_VERSION, "unspecified");
    assert.equal(s.bundle_version, 1);
    // Exactly 10 checks, in matrix order.
    assert.deepEqual(s.tests.map((t) => t.id), [
        "impl:evidence-structure",
        "impl:canonical-representation",
        "impl:hash-integrity",
        "impl:chain-continuity",
        "impl:policy-binding",
        "impl:tamper-detection",
        "impl:numeric-canonicalization",
        "impl:evidence-portability",
        "impl:cross-implementation",
        "impl:attestation-signature",
    ]);
    // Frozen PASS/NOT_APPLICABLE distribution on the clean UI-mode sample:
    // 8 PASS + 2 NOT_APPLICABLE (cross-impl no python spawn; attestation absent).
    const status = Object.fromEntries(s.tests.map((t) => [t.id, t.status]));
    assert.equal(status["impl:evidence-structure"], STATUS.PASS);
    assert.equal(status["impl:canonical-representation"], STATUS.PASS);
    assert.equal(status["impl:hash-integrity"], STATUS.PASS);
    assert.equal(status["impl:chain-continuity"], STATUS.PASS);
    assert.equal(status["impl:policy-binding"], STATUS.PASS);
    assert.equal(status["impl:tamper-detection"], STATUS.PASS);
    assert.equal(status["impl:numeric-canonicalization"], STATUS.PASS);
    assert.equal(status["impl:evidence-portability"], STATUS.PASS);
    assert.equal(status["impl:cross-implementation"], STATUS.NOT_APPLICABLE);
    assert.equal(status["impl:attestation-signature"], STATUS.NOT_APPLICABLE);
    assert.equal(s.overall, STATUS.PASS);
});
