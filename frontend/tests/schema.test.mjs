/**
 * R1 remediation: validates the current implementation output against the
 * documented implementation-level bundle schema (docs/BUNDLE_SCHEMA.md).
 * Non-normative.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const { buildHashChain } = await import("../src/lib/verification.js");
const { buildEvidenceBundle } = await import("../src/lib/exportBundle.js");
const { SAMPLE_SESSION } = await import("../src/lib/sampleData.js");

function isString(v) { return typeof v === "string" && v.length > 0; }
function isHex64(v) { return typeof v === "string" && /^[0-9a-f]{64}$/.test(v); }

test("R1: bundle envelope matches implementation schema", async () => {
    const chained = await buildHashChain(SAMPLE_SESSION.decisions);
    // eslint-disable-next-line no-unused-vars
    const { decisions: _d, ...meta } = SAMPLE_SESSION;
    const bundle = buildEvidenceBundle({ rawSession: meta, decisions: chained, importedHadEvidence: false });
    assert.equal(bundle.bundle_version, 1);
    assert.ok(isString(bundle.exported_at));
    assert.ok(["imported", "synthesized-from-source"].includes(bundle.source));
    assert.ok(isString(bundle.note));
    assert.equal(typeof bundle.session, "object");
});

test("R1: session object required fields present and typed", async () => {
    const chained = await buildHashChain(SAMPLE_SESSION.decisions);
    // eslint-disable-next-line no-unused-vars
    const { decisions: _d, ...meta } = SAMPLE_SESSION;
    const b = buildEvidenceBundle({ rawSession: meta, decisions: chained, importedHadEvidence: false });
    assert.ok(Array.isArray(b.session.registered_policy_versions));
    for (const p of b.session.registered_policy_versions) assert.ok(isString(p));
    assert.ok(Array.isArray(b.session.decisions));
    assert.ok(b.session.decisions.length > 0);
});

test("R1: every decision + evidence matches implementation schema", async () => {
    const chained = await buildHashChain(SAMPLE_SESSION.decisions);
    // eslint-disable-next-line no-unused-vars
    const { decisions: _d, ...meta } = SAMPLE_SESSION;
    const b = buildEvidenceBundle({ rawSession: meta, decisions: chained, importedHadEvidence: false });
    const registered = new Set(b.session.registered_policy_versions);
    b.session.decisions.forEach((d, i) => {
        assert.ok(isString(d.id), `decision[${i}].id`);
        assert.ok(isString(d.policy_version) && registered.has(d.policy_version), `decision[${i}].policy_version registered`);
        assert.equal(typeof d.evidence, "object");
        assert.ok(isString(d.evidence.canonical_representation), `evidence[${i}].canonical_representation`);
        assert.ok(isHex64(d.evidence.canonical_hash), `evidence[${i}].canonical_hash hex64`);
        assert.ok(isHex64(d.evidence.prev_hash), `evidence[${i}].prev_hash hex64`);
        assert.ok(isHex64(d.evidence.chain_hash), `evidence[${i}].chain_hash hex64`);
        if (i === 0) assert.equal(d.evidence.prev_hash, "0".repeat(64), "genesis prev_hash");
    });
});
