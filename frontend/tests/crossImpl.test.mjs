/**
 * INV-XIM-01 — Live cross-implementation agreement (Node CLI ↔ Python).
 *
 * Runs the Node CLI against a fresh sample bundle with the DEFAULT flow
 * (cross-impl ON) and asserts:
 *   - impl:cross-implementation = PASS on a clean bundle.
 *   - Overall PASS.
 *   - Tampered bundle → impl:cross-implementation is either PASS (both
 *     verifiers agree that other invariants FAIL) or FAIL, but overall FAIL.
 *   - `--no-cross-impl` returns impl:cross-implementation = NOT_APPLICABLE.
 *   - Bogus python binary → NOT_APPLICABLE with a reason, and overall stays PASS.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const { buildHashChain } = await import("../src/lib/verification.js");
const { buildEvidenceBundle } = await import("../src/lib/exportBundle.js");
const { SAMPLE_SESSION } = await import("../src/lib/sampleData.js");
const { STATUS } = await import("../src/lib/conformanceCore.js");

const CLI = "/app/cli/aura-verify.mjs";

function runCli(args) {
    const r = spawnSync("node", [CLI, ...args], { encoding: "utf8" });
    return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

async function exportSample() {
    const chained = await buildHashChain(SAMPLE_SESSION.decisions);
    // eslint-disable-next-line no-unused-vars
    const { decisions: _d, ...meta } = SAMPLE_SESSION;
    return buildEvidenceBundle({ rawSession: meta, decisions: chained, importedHadEvidence: false });
}

function withTempFile(bundle, fn) {
    const dir = mkdtempSync(join(tmpdir(), "aura-xim-"));
    const p = join(dir, "bundle.json");
    writeFileSync(p, JSON.stringify(bundle, null, 2));
    try { return fn(p); } finally { rmSync(dir, { recursive: true, force: true }); }
}

test("INV-XIM-01: clean bundle → CLI default (Python spawned) → cross-impl PASS", async () => {
    const bundle = await exportSample();
    const out = withTempFile(bundle, (p) => runCli([p, "--json"]));
    assert.equal(out.code, 0, `stderr:\n${out.stderr}`);
    const suite = JSON.parse(out.stdout);
    const t = suite.tests.find((x) => x.id === "impl:cross-implementation");
    assert.equal(t.status, STATUS.PASS, t.message);
    assert.match(t.message, /Live agreement/);
    assert.match(t.message, /aura-verify-py/);
});

test("INV-XIM-01: --no-cross-impl → NOT_APPLICABLE with clear reason, overall still PASS", async () => {
    const bundle = await exportSample();
    const out = withTempFile(bundle, (p) => runCli([p, "--json", "--no-cross-impl"]));
    assert.equal(out.code, 0);
    const suite = JSON.parse(out.stdout);
    assert.equal(suite.overall, STATUS.PASS);
    const t = suite.tests.find((x) => x.id === "impl:cross-implementation");
    assert.equal(t.status, STATUS.NOT_APPLICABLE);
    assert.match(t.message, /--no-cross-impl|browser/);
});

test("INV-XIM-01: unavailable python binary → NOT_APPLICABLE (honest), overall still PASS", async () => {
    const bundle = await exportSample();
    const out = withTempFile(bundle, (p) =>
        runCli([p, "--json", "--py", "/does/not/exist/python", "--py-script", "/app/py_verifier/aura_verify.py"])
    );
    assert.equal(out.code, 0);
    const suite = JSON.parse(out.stdout);
    const t = suite.tests.find((x) => x.id === "impl:cross-implementation");
    assert.equal(t.status, STATUS.NOT_APPLICABLE);
    assert.match(t.message, /Second implementation not available/);
});

test("INV-XIM-01: missing python script → NOT_APPLICABLE, overall still PASS", async () => {
    const bundle = await exportSample();
    const out = withTempFile(bundle, (p) =>
        runCli([p, "--json", "--py-script", "/does/not/exist.py"])
    );
    assert.equal(out.code, 0);
    const suite = JSON.parse(out.stdout);
    const t = suite.tests.find((x) => x.id === "impl:cross-implementation");
    assert.equal(t.status, STATUS.NOT_APPLICABLE);
    assert.match(t.message, /python verifier script not found/);
});

test("INV-XIM-01: tampered bundle → both verifiers agree on FAIL, cross-impl PASS (agreement holds)", async () => {
    const bundle = await exportSample();
    bundle.session.decisions[2] = { ...bundle.session.decisions[2], reason: "TAMPERED_FOR_XIM" };
    const out = withTempFile(bundle, (p) => runCli([p, "--json"]));
    assert.equal(out.code, 1); // overall FAIL
    const suite = JSON.parse(out.stdout);
    assert.equal(suite.overall, STATUS.FAIL);
    // Cross-impl compares per-test statuses; both verifiers see the same
    // FAILures → they agree → PASS on the agreement check.
    const t = suite.tests.find((x) => x.id === "impl:cross-implementation");
    assert.equal(t.status, STATUS.PASS, `agreement should hold even on FAIL: ${t.message}`);
    // Integrity fails on both.
    assert.equal(suite.tests.find((x) => x.id === "impl:hash-integrity").status, STATUS.FAIL);
});
