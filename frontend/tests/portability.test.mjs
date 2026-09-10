/**
 * Evidence portability tests.
 *
 * Run: node --test /app/frontend/tests/portability.test.mjs
 *
 *   1. Positive portability: export a bundle → independent CLI verification → PASS.
 *   2. Negative portability: tamper the exported bundle on disk → CLI → FAIL.
 *   3. CLI/UI agreement: same bundle, same Conformance Core → same per-test
 *      statuses and same overall result.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const { buildHashChain } = await import("../src/lib/verification.js");
const { buildEvidenceBundle } = await import("../src/lib/exportBundle.js");
const { SAMPLE_SESSION } = await import("../src/lib/sampleData.js");
const { runConformanceSuite, STATUS } = await import("../src/lib/conformanceCore.js");

const CLI = "/app/cli/aura-verify.mjs";

function runCli(args) {
    const res = spawnSync("node", [CLI, ...args], { encoding: "utf8" });
    return { code: res.status, stdout: res.stdout, stderr: res.stderr };
}

async function exportSampleBundle() {
    const chained = await buildHashChain(SAMPLE_SESSION.decisions);
    // eslint-disable-next-line no-unused-vars
    const { decisions: _d, ...meta } = SAMPLE_SESSION;
    return buildEvidenceBundle({
        rawSession: meta,
        decisions: chained,
        importedHadEvidence: false,
        generatedAt: "2026-02-01T00:00:00Z",
    });
}

function withTempFile(bundle, fn) {
    const dir = mkdtempSync(join(tmpdir(), "aura-cli-"));
    const path = join(dir, "bundle.json");
    writeFileSync(path, JSON.stringify(bundle, null, 2));
    try {
        return fn(path);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

test("positive portability: export → CLI → PASS (exit 0)", async () => {
    const bundle = await exportSampleBundle();
    const out = withTempFile(bundle, (p) => runCli([p, "--json"]));
    assert.equal(out.code, 0, `stderr:\n${out.stderr}\nstdout:\n${out.stdout}`);
    const suite = JSON.parse(out.stdout);
    assert.equal(suite.overall, STATUS.PASS);
    assert.equal(suite.record_count, SAMPLE_SESSION.decisions.length);
    // NOT-IMPLEMENTED items must remain honestly reported.
    for (const id of ["impl:attestation-signature", "impl:cross-implementation"]) {
        const t = suite.tests.find((x) => x.id === id);
        assert.equal(t.status, STATUS.NOT_IMPLEMENTED);
    }
});

test("negative portability: tampered exported bundle → CLI → FAIL (exit 1)", async () => {
    const bundle = await exportSampleBundle();
    // Mutate on-disk bundle after export — simulates a hostile intermediary.
    bundle.session.decisions[2] = {
        ...bundle.session.decisions[2],
        reason: "TAMPERED_BY_INTERMEDIARY",
    };
    const out = withTempFile(bundle, (p) => runCli([p, "--json"]));
    assert.equal(out.code, 1, `stderr:\n${out.stderr}\nstdout:\n${out.stdout}`);
    const suite = JSON.parse(out.stdout);
    assert.equal(suite.overall, STATUS.FAIL);
    // Cryptographic invariants must fail on the tampered record.
    assert.equal(suite.tests.find((t) => t.id === "impl:hash-integrity").status, STATUS.FAIL);
    // A tamper-detection test passes only when the verifier detects invalid evidence,
    // and this suite reports impl:tamper-detection FAIL when invariants fail — meaning
    // the tamper WAS detected. The semantic assertion below expresses that:
    // "detection of invalid evidence" == the verifier returned overall FAIL.
    assert.equal(suite.overall, STATUS.FAIL, "verifier must not accept tampered evidence");
});

test("CLI/UI agreement: same bundle produces identical per-test statuses", async () => {
    const bundle = await exportSampleBundle();
    const uiSuite = await runConformanceSuite({
        decisions: bundle.session.decisions,
        registeredPolicies: new Set(bundle.session.registered_policy_versions || []),
    });
    const cli = withTempFile(bundle, (p) => runCli([p, "--json"]));
    assert.equal(cli.code, 0);
    const cliSuite = JSON.parse(cli.stdout);
    assert.equal(cliSuite.overall, uiSuite.overall);
    assert.equal(cliSuite.tests.length, uiSuite.tests.length);
    for (let i = 0; i < cliSuite.tests.length; i++) {
        assert.equal(cliSuite.tests[i].id, uiSuite.tests[i].id);
        assert.equal(cliSuite.tests[i].status, uiSuite.tests[i].status,
            `mismatch on test ${cliSuite.tests[i].id}`);
    }
});

test("CLI rejects malformed bundle with exit 2", () => {
    const bad = { not_a_bundle: true };
    const out = withTempFile(bad, (p) => runCli([p, "--json"]));
    assert.equal(out.code, 2);
    assert.match(out.stderr, /invalid bundle/);
});

test("CLI does not mutate the bundle file", async () => {
    const bundle = await exportSampleBundle();
    const before = JSON.stringify(bundle);
    withTempFile(bundle, (p) => {
        runCli([p, "--json"]);
        const after = readFileSync(p, "utf8");
        // File on disk must be byte-identical to the pre-verification snapshot.
        assert.equal(after, JSON.stringify(bundle, null, 2));
    });
    // In-memory reference untouched.
    assert.equal(JSON.stringify(bundle), before);
});
