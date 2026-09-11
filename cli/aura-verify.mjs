#!/usr/bin/env node
/**
 * aura-verify — Standalone verifier for Aura-Guard evidence bundles.
 *
 * Design constraints:
 *   - Reuse existing canonicalization + SHA-256 primitives from the frontend
 *     `lib/verification.js`. No new crypto semantics.
 *   - Reuse the Conformance Core (`lib/conformanceCore.js`) so the CLI and
 *     the UI produce the same result for the same bundle by construction.
 *   - Read-only. Never mutates or "repairs" the evidence bundle.
 *   - No dependency on any UI/browser/session state.
 *
 * Cross-implementation (INV-XIM-01):
 *   - By default the CLI spawns the Python reference verifier
 *     (`/app/py_verifier/aura_verify.py`) with the SAME bundle file,
 *     compares per-test statuses (excluding `impl:cross-implementation`
 *     itself, which is inherently local), and emits `impl:cross-implementation`
 *     = PASS iff they agree, FAIL iff they don't, NOT APPLICABLE iff Python
 *     is unavailable or `--no-cross-impl` is set.
 *
 * Usage:
 *   aura-verify <bundle.json>                   # human-readable summary
 *   aura-verify <bundle.json> --json            # machine-readable JSON
 *   aura-verify <bundle.json> --no-cross-impl   # skip live cross-impl check
 *   aura-verify <bundle.json> --py <python> --py-script <path>  # override
 *
 * Exit codes: 0 PASS · 1 FAIL · 2 bad input.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const HERE = new URL(".", import.meta.url).pathname;
const { runConformanceSuite, STATUS } = await import(
    resolve(HERE, "../frontend/src/lib/conformanceCore.js")
);

const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";

const DEFAULT_PY = process.env.AURA_PY_BIN || "python3";
const DEFAULT_PY_SCRIPT = process.env.AURA_PY_VERIFIER || "/app/py_verifier/aura_verify.py";

function usage() {
    process.stderr.write(
        "Usage: aura-verify <bundle.json> [--json] [--no-cross-impl] [--py <bin>] [--py-script <path>]\n" +
        "  Verifies an Aura-Guard evidence bundle independently.\n" +
        "  Exit codes: 0 PASS · 1 FAIL · 2 bad input.\n"
    );
}

function parseArgs(argv) {
    const args = { path: null, json: false, cross: true, py: DEFAULT_PY, pyScript: DEFAULT_PY_SCRIPT };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--json") args.json = true;
        else if (a === "--no-cross-impl") args.cross = false;
        else if (a === "--py") args.py = argv[++i];
        else if (a === "--py-script") args.pyScript = argv[++i];
        else if (a === "-h" || a === "--help") { usage(); process.exit(2); }
        else if (a.startsWith("--")) { usage(); process.exit(2); }
        else if (!args.path) args.path = a;
        else { usage(); process.exit(2); }
    }
    if (!args.path) { usage(); process.exit(2); }
    return args;
}

function validateBundle(b) {
    if (!b || typeof b !== "object" || Array.isArray(b)) throw new Error("Bundle must be a JSON object.");
    if (b.bundle_version !== 1) throw new Error(`Unsupported bundle_version: ${b.bundle_version}`);
    if (!b.session || typeof b.session !== "object") throw new Error("Bundle is missing `session`.");
    if (!Array.isArray(b.session.decisions)) throw new Error("Bundle.session is missing `decisions[]`.");
}

function statusColor(s) {
    return s === STATUS.PASS ? GREEN
        : s === STATUS.FAIL ? RED
        : YELLOW;
}

function formatHuman(suite, bundle) {
    const lines = [];
    lines.push(`${BOLD}Aura-Guard · Standalone Verifier${RESET}`);
    lines.push(`${DIM}(read-only; no evidence mutation; reuses UI Conformance Core)${RESET}`);
    lines.push("");
    lines.push(`Bundle:            ${CYAN}${bundle.session.session_id || "(unknown)"}${RESET}`);
    lines.push(`Exported at:       ${bundle.exported_at || "-"}`);
    lines.push(`Source:            ${bundle.source || "-"}`);
    lines.push(`Protocol version:  ${suite.protocol_version}`);
    lines.push(`Verifier version:  ${suite.verifier_version}`);
    lines.push(`Bundle version:    ${suite.bundle_version}`);
    lines.push(`Records:           ${suite.record_count}`);
    lines.push("");
    lines.push(`Overall:           ${statusColor(suite.overall)}${BOLD}${suite.overall}${RESET}`);
    lines.push("");
    lines.push(`${BOLD}Tests${RESET}`);
    for (const t of suite.tests) {
        const c = statusColor(t.status);
        lines.push(
            `  ${c}${t.status.padEnd(15)}${RESET}  ${t.id.padEnd(34)}  ${DIM}${t.label}${RESET}`
        );
        if (t.status === STATUS.FAIL) {
            lines.push(`  ${DIM}${"".padEnd(15)}${RESET}  ${DIM}${" ".repeat(34)}${RESET}  ${t.message}`);
        }
    }
    lines.push("");
    return lines.join("\n");
}

/**
 * Spawn Python reference verifier and compute a cross-impl agreement result.
 * Returns null if the caller has disabled the check (--no-cross-impl).
 */
function runCrossImpl(bundlePath, { py, pyScript }) {
    if (!existsSync(pyScript)) {
        return { ran: false, reason: `python verifier script not found at ${pyScript}` };
    }
    let r;
    try {
        r = spawnSync(py, [pyScript, bundlePath, "--json"], { encoding: "utf8" });
    } catch (e) {
        return { ran: false, reason: `spawn failed: ${e.message}` };
    }
    if (r.error) return { ran: false, reason: `spawn error: ${r.error.message}` };
    if (r.status === 2)  return { ran: false, reason: `python verifier rejected bundle (exit 2): ${r.stderr.trim()}` };
    if (r.status !== 0 && r.status !== 1) {
        return { ran: false, reason: `python verifier exit=${r.status}: ${r.stderr.trim()}` };
    }
    let pySuite;
    try {
        pySuite = JSON.parse(r.stdout);
    } catch (e) {
        return { ran: false, reason: `python verifier stdout is not JSON: ${e.message}` };
    }
    return { ran: true, py_suite: pySuite, verifier_version: pySuite.verifier_version };
}

/**
 * Given the Node suite and the Python suite, compute PASS/FAIL agreement.
 * We EXCLUDE `impl:cross-implementation` from comparison (each verifier's
 * cross-impl check is by definition local to that verifier).
 */
function agreementFrom(nodeSuite, pyProbe) {
    if (!pyProbe || !pyProbe.ran) return pyProbe || null;
    const pySuite = pyProbe.py_suite;
    const nodeIds = new Set(nodeSuite.tests.map((t) => t.id));
    const commonIds = pySuite.tests
        .map((t) => t.id)
        .filter((id) => nodeIds.has(id) && id !== "impl:cross-implementation");
    const mismatches = [];
    for (const id of commonIds) {
        const n = nodeSuite.tests.find((t) => t.id === id).status;
        const p = pySuite.tests.find((t) => t.id === id).status;
        if (n !== p) mismatches.push({ id, this: n, other: p });
    }
    return {
        ran: true,
        agree: mismatches.length === 0,
        compared_ids: commonIds,
        mismatches,
        verifier_version: pyProbe.verifier_version,
    };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const inPath = resolve(process.cwd(), args.path);
    let raw;
    try { raw = readFileSync(inPath, "utf8"); }
    catch (e) { process.stderr.write(`aura-verify: cannot read bundle: ${e.message}\n`); process.exit(2); }

    let bundle;
    try { bundle = JSON.parse(raw); validateBundle(bundle); }
    catch (e) { process.stderr.write(`aura-verify: invalid bundle: ${e.message}\n`); process.exit(2); }

    // Step 1 — run the Node conformance suite WITHOUT crossImpl to get the
    // Node baseline that we will compare against the Python suite.
    const registeredPolicies = new Set(bundle.session.registered_policy_versions || []);
    const localSuite = await runConformanceSuite({
        decisions: bundle.session.decisions,
        registeredPolicies,
        session: bundle.session,
        attestation: bundle.attestation,
    });

    // Step 2 — spawn Python if enabled.
    let pyProbe = null;
    if (args.cross) {
        pyProbe = runCrossImpl(inPath, { py: args.py, pyScript: args.pyScript });
    }
    const crossImplResult = agreementFrom(localSuite, pyProbe);

    // Step 3 — re-run the suite with the cross-impl result so
    // impl:cross-implementation is properly PASS/FAIL/NOT_APPLICABLE.
    const suite = await runConformanceSuite({
        decisions: bundle.session.decisions,
        registeredPolicies,
        session: bundle.session,
        attestation: bundle.attestation,
        crossImplResult,
    });

    const output = { ...suite, session_verification: undefined };
    if (args.json) process.stdout.write(JSON.stringify(output, null, 2) + "\n");
    else            process.stdout.write(formatHuman(suite, bundle));

    process.exit(suite.overall === STATUS.PASS ? 0 : 1);
}

main().catch((e) => {
    process.stderr.write(`aura-verify: unexpected error: ${e.stack || e.message}\n`);
    process.exit(2);
});
