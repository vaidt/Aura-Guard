/**
 * INV-ATT-01 — Attestation signature tests.
 *
 * Positive path (sign → verify → PASS) plus every declared negative reason
 * (unknown key, revoked key, out-of-window, payload mismatch, bad signature,
 * malformed attestation, no attestation → NOT_APPLICABLE).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const { buildHashChain } = await import("../src/lib/verification.js");
const { runConformanceSuite, STATUS } = await import("../src/lib/conformanceCore.js");
const { signAttestation, verifyAttestation, ATTESTATION_VERSION } = await import("../src/lib/attestation.js");
const { DEFAULT_SIGNING_KEY_REGISTRY } = await import("../src/lib/signingKeys.js");
const { SAMPLE_SESSION } = await import("../src/lib/sampleData.js");

const KEY_ID = "aura-key-2026Q1-demo-001";
const PRIV = "09aba6d5961012bccfd881000e2e5a8889836d333f0a262dec9920321f766053";
const PUB  = "77b32cb4e8795e28e96a1f1621d73ed08e1903507434080a853e85d60f70ad06";

async function attestedSample(signed_at = "2026-02-02T00:00:00Z") {
    const chained = await buildHashChain(SAMPLE_SESSION.decisions);
    // eslint-disable-next-line no-unused-vars
    const { decisions: _d, ...session } = SAMPLE_SESSION;
    const attestation = await signAttestation({
        session, decisions: chained, key_id: KEY_ID, priv_hex: PRIV, pub_hex: PUB, signed_at,
    });
    return { session, decisions: chained, attestation };
}

test("registry mirror: signingKeys.js == config/signing_keys.json", () => {
    const disk = JSON.parse(readFileSync("/app/config/signing_keys.json", "utf8"));
    assert.equal(DEFAULT_SIGNING_KEY_REGISTRY.length, disk.keys.length);
    for (let i = 0; i < disk.keys.length; i++) {
        for (const f of ["key_id","algorithm","public_key_hex","status","valid_from","valid_until"]) {
            assert.equal(DEFAULT_SIGNING_KEY_REGISTRY[i][f], disk.keys[i][f], `${f} @ row ${i}`);
        }
    }
});

test("positive: sign → verify → PASS via conformance suite", async () => {
    const { session, decisions, attestation } = await attestedSample();
    const s = await runConformanceSuite({
        decisions, registeredPolicies: new Set(SAMPLE_SESSION.registered_policy_versions),
        session, attestation,
    });
    const t = s.tests.find((x) => x.id === "impl:attestation-signature");
    assert.equal(t.status, STATUS.PASS, t.message);
    assert.match(t.message, /Ed25519/);
    assert.equal(s.overall, STATUS.PASS);
});

test("no attestation → NOT_APPLICABLE (overall still PASS)", async () => {
    const chained = await buildHashChain(SAMPLE_SESSION.decisions);
    const s = await runConformanceSuite({
        decisions: chained, registeredPolicies: new Set(SAMPLE_SESSION.registered_policy_versions),
        session: SAMPLE_SESSION,
    });
    const t = s.tests.find((x) => x.id === "impl:attestation-signature");
    assert.equal(t.status, STATUS.NOT_APPLICABLE);
    assert.equal(s.overall, STATUS.PASS);
});

test("negative: tampered decision after signing → payload_mismatch FAIL", async () => {
    const { session, decisions, attestation } = await attestedSample();
    // Mutate a decision AFTER signing — final chain hash changes.
    const mutated = decisions.map((d, i) =>
        i === 0 ? { ...d, reason: "TAMPERED_POST_SIGN" } : d
    );
    const r = await verifyAttestation({ attestation, session, decisions: mutated });
    assert.equal(r.pass, false);
    assert.equal(r.code, "payload_mismatch");
});

test("negative: bad signature → bad_signature FAIL", async () => {
    const { session, decisions, attestation } = await attestedSample();
    const bad = { ...attestation, signature: "00".repeat(64) };
    const r = await verifyAttestation({ attestation: bad, session, decisions });
    assert.equal(r.pass, false);
    assert.equal(r.code, "bad_signature");
});

test("negative: unknown key_id → unknown_key FAIL", async () => {
    const { session, decisions, attestation } = await attestedSample();
    const bad = { ...attestation, key_id: "aura-key-does-not-exist" };
    const r = await verifyAttestation({ attestation: bad, session, decisions });
    assert.equal(r.pass, false);
    assert.equal(r.code, "unknown_key");
});

test("negative: revoked key_id → revoked_key FAIL", async () => {
    const { session, decisions } = await attestedSample();
    // Build an attestation that CLAIMS to be from the revoked key.
    // Even if the signature bytes are garbage, the revocation gate MUST fire
    // before signature verification.
    const bad = {
        attestation_version: ATTESTATION_VERSION, algorithm: "ed25519",
        key_id: "aura-key-2025-revoked-demo-001",
        signed_at: "2025-06-01T00:00:00Z",
        signed_payload: "{}",
        signature: "00".repeat(64),
    };
    const r = await verifyAttestation({ attestation: bad, session, decisions });
    assert.equal(r.pass, false);
    assert.equal(r.code, "revoked_key");
});

test("negative: signed_at outside key validity window → out_of_window FAIL", async () => {
    // Sign with a signed_at BEFORE valid_from of the active key.
    const { session, decisions, attestation } = await attestedSample("2020-01-01T00:00:00Z");
    const r = await verifyAttestation({ attestation, session, decisions });
    assert.equal(r.pass, false);
    assert.equal(r.code, "out_of_window");
});

test("negative: unsupported algorithm → unsupported_algorithm FAIL", async () => {
    const { session, decisions, attestation } = await attestedSample();
    const bad = { ...attestation, algorithm: "hmac-sha256" };
    const r = await verifyAttestation({ attestation: bad, session, decisions });
    assert.equal(r.pass, false);
    assert.equal(r.code, "unsupported_algorithm");
});

test("negative: malformed attestation missing signature → malformed_attestation FAIL", async () => {
    const { session, decisions, attestation } = await attestedSample();
    // eslint-disable-next-line no-unused-vars
    const { signature: _s, ...bad } = attestation;
    const r = await verifyAttestation({ attestation: bad, session, decisions });
    assert.equal(r.pass, false);
    assert.equal(r.code, "malformed_attestation");
});

test("tamper cascade: mutation makes the attestation FAIL in the suite", async () => {
    const { session, decisions, attestation } = await attestedSample();
    const mutated = decisions.map((d, i) =>
        i === 3 ? { ...d, reason: "post-sign-tamper" } : d
    );
    const s = await runConformanceSuite({
        decisions: mutated, registeredPolicies: new Set(SAMPLE_SESSION.registered_policy_versions),
        session, attestation,
    });
    const t = s.tests.find((x) => x.id === "impl:attestation-signature");
    assert.equal(t.status, STATUS.FAIL);
    assert.equal(t.code, "payload_mismatch");
    assert.equal(s.overall, STATUS.FAIL);
});
