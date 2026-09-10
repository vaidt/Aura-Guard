/**
 * Regression tests for Aura-Guard Compliance Auditor.
 *
 * Run:   node --test /app/frontend/tests/verification.test.mjs
 *
 * Covers:
 *   - Valid session with { decisions: [...] }
 *   - Malformed / missing `decisions` array
 *   - Decision records with optional / missing fields
 *   - Hash-chain rendering data (chain_hash flows into next.prev_hash)
 *   - Evidence bundle export shape (preserves session, does not invent fields)
 *
 * Note: the frontend lib uses `crypto.subtle` and ESM imports with `@` aliases.
 * For these tests we import from relative paths and use Node's built-in
 * webcrypto so no browser or bundler is required.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const {
    canonicalize,
    sha256Hex,
    buildHashChain,
    verifySession,
} = await import("../src/lib/verification.js");
const { hasFullEvidence, humanize, truncHash, DASH } = await import("../src/lib/format.js");
const { buildEvidenceBundle } = await import("../src/lib/exportBundle.js");

// Inline the validator (it's exported from AuditContext.jsx which we can't load
// under node without JSX). Kept in lockstep with AuditContext.validateSessionInput.
function validateSessionInput(parsed) {
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Session must be a JSON object.");
    }
    if (!Array.isArray(parsed.decisions)) {
        throw new Error("Session is missing a `decisions` array.");
    }
    for (const [i, d] of parsed.decisions.entries()) {
        if (!d || typeof d !== "object" || Array.isArray(d)) {
            throw new Error(`decisions[${i}] must be an object.`);
        }
        if (!d.id) {
            throw new Error(`decisions[${i}] is missing required field \`id\`.`);
        }
    }
    return true;
}

const REGISTERED = new Set(["policy-2025.11-r1", "policy-2025.12-r2"]);

const validSession = {
    session_id: "S-1",
    registered_policy_versions: ["policy-2025.11-r1"],
    decisions: [
        {
            id: "D-1",
            timestamp: "2026-01-01T00:00:00Z",
            action: "credit_review",
            policy_version: "policy-2025.11-r1",
            policy_status: "compliant",
            reason: "ok",
            input: { a: 1 },
            output: { decision: "approve" },
        },
        {
            id: "D-2",
            timestamp: "2026-01-01T00:01:00Z",
            action: "credit_review",
            policy_version: "policy-2025.11-r1",
            policy_status: "warning",
            reason: "review",
            input: { a: 2 },
            output: { decision: "manual_review" },
        },
    ],
};

test("canonicalize sorts keys deterministically", () => {
    const a = canonicalize({ b: 1, a: [{ z: 2, y: 1 }] });
    const b = canonicalize({ a: [{ y: 1, z: 2 }], b: 1 });
    assert.equal(a, b);
    assert.equal(a, '{"a":[{"y":1,"z":2}],"b":1}');
});

test("sha256Hex produces stable 64-char hex", async () => {
    const h = await sha256Hex("hello");
    assert.equal(h.length, 64);
    assert.equal(h, "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
});

test("valid session with { decisions: [...] } passes validation", () => {
    assert.doesNotThrow(() => validateSessionInput(validSession));
});

test("malformed session (no decisions) throws", () => {
    assert.throws(() => validateSessionInput({}), /decisions/);
    assert.throws(() => validateSessionInput(null), /JSON object/);
    assert.throws(() => validateSessionInput([]), /JSON object/);
    assert.throws(() => validateSessionInput({ decisions: "nope" }), /decisions/);
});

test("decision missing id throws; decision missing optional fields does NOT throw", () => {
    assert.throws(
        () => validateSessionInput({ decisions: [{ action: "x" }] }),
        /id/
    );
    // Only `id` is required — other fields are optional.
    assert.doesNotThrow(() =>
        validateSessionInput({ decisions: [{ id: "OK-1" }] })
    );
});

test("humanize / truncHash / hasFullEvidence handle undefined safely", () => {
    assert.equal(humanize(undefined), DASH);
    assert.equal(humanize(null), DASH);
    assert.equal(humanize("credit_application_review"), "credit application review");
    assert.equal(truncHash(undefined), DASH);
    assert.equal(truncHash("abcdef0123456789abcdef", 8), "abcdef01…");
    assert.equal(hasFullEvidence({}), false);
    assert.equal(hasFullEvidence({ evidence: { canonical_hash: "a" } }), false);
    assert.equal(
        hasFullEvidence({
            evidence: { canonical_hash: "a", prev_hash: "b", chain_hash: "c" },
        }),
        true
    );
});

test("buildHashChain: each next.prev_hash == prev.chain_hash (render-safe chain)", async () => {
    const chained = await buildHashChain(validSession.decisions);
    assert.equal(chained.length, 2);
    for (let i = 1; i < chained.length; i++) {
        assert.equal(
            chained[i].evidence.prev_hash,
            chained[i - 1].evidence.chain_hash,
            `chain broken at index ${i}`
        );
    }
    const v = await verifySession(chained, REGISTERED);
    assert.equal(v.allPass, true);
});

test("tamper propagates: mutating one field cascades hash-chain failures", async () => {
    const chained = await buildHashChain(validSession.decisions);
    const tampered = chained.map((d, i) =>
        i === 0 ? { ...d, reason: "TAMPERED" } : d
    );
    const v = await verifySession(tampered, REGISTERED);
    assert.equal(v.allPass, false);
    assert.equal(v.results[0].checks.sha256_integrity.pass, false);
    assert.equal(v.results[1].checks.hash_chain_continuity.pass, false);
});

test("verifySession tolerates decisions with missing optional fields", async () => {
    const minimal = [
        { id: "M-1", policy_version: "policy-2025.11-r1" },
        { id: "M-2", policy_version: "policy-2025.11-r1" },
    ];
    const chained = await buildHashChain(minimal);
    // Every decision must gain a full evidence block.
    for (const d of chained) {
        assert.equal(hasFullEvidence(d), true);
    }
    const v = await verifySession(chained, REGISTERED);
    assert.equal(v.allPass, true);
});

test("evidence bundle export preserves session shape and does not invent audit fields", async () => {
    const chained = await buildHashChain(validSession.decisions);
    const bundle = buildEvidenceBundle({
        rawSession: { ...validSession, decisions: undefined, session_id: "S-1" },
        decisions: chained,
        importedHadEvidence: false,
        generatedAt: "2026-02-01T00:00:00Z",
    });
    // Envelope
    assert.equal(bundle.bundle_version, 1);
    assert.equal(bundle.source, "synthesized-from-source");
    assert.equal(bundle.exported_at, "2026-02-01T00:00:00Z");
    // Session preserved verbatim + decisions carried
    assert.equal(bundle.session.session_id, "S-1");
    assert.deepEqual(bundle.session.registered_policy_versions, ["policy-2025.11-r1"]);
    assert.equal(bundle.session.decisions.length, 2);
    // Fields on each decision are exactly the ones we put in — no invention.
    const expectedKeys = new Set([
        "id", "timestamp", "action", "policy_version", "policy_status",
        "reason", "input", "output", "evidence",
    ]);
    for (const d of bundle.session.decisions) {
        for (const k of Object.keys(d)) {
            assert.ok(expectedKeys.has(k), `unexpected exported field: ${k}`);
        }
    }
});

test("evidence bundle marks source=imported when the imported session already had evidence", async () => {
    const chained = await buildHashChain(validSession.decisions);
    const bundle = buildEvidenceBundle({
        rawSession: { session_id: "S-1" },
        decisions: chained,
        importedHadEvidence: true,
    });
    assert.equal(bundle.source, "imported");
});
