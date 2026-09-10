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
 * Usage:
 *   aura-verify <bundle.json>            # human-readable summary
 *   aura-verify <bundle.json> --json     # machine-readable JSON
 *
 * Exit codes: 0 PASS · 1 FAIL · 2 bad input.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto;

// Import the same verification + Conformance Core the UI uses.
// Both files live under /app/frontend/src/lib and are pure ESM with no DOM deps.
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

function usage() {
    process.stderr.write(
        "Usage: aura-verify <bundle.json> [--json]\n" +
        "  Verifies an Aura-Guard evidence bundle independently.\n" +
        "  Exit codes: 0 PASS · 1 FAIL · 2 bad input.\n"
    );
}

function validateBundle(b) {
    if (!b || typeof b !== "object" || Array.isArray(b)) {
        throw new Error("Bundle must be a JSON object.");
    }
    if (b.bundle_version !== 1) {
        throw new Error(`Unsupported bundle_version: ${b.bundle_version}`);
    }
    if (!b.session || typeof b.session !== "object") {
        throw new Error("Bundle is missing `session`.");
    }
    if (!Array.isArray(b.session.decisions)) {
        throw new Error("Bundle.session is missing `decisions[]`.");
    }
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

async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
        usage();
        process.exit(2);
    }
    const asJson = args.includes("--json");
    const path = args.find((a) => !a.startsWith("--"));
    if (!path) { usage(); process.exit(2); }

    let raw;
    try {
        raw = readFileSync(resolve(process.cwd(), path), "utf8");
    } catch (e) {
        process.stderr.write(`aura-verify: cannot read bundle: ${e.message}\n`);
        process.exit(2);
    }

    let bundle;
    try {
        bundle = JSON.parse(raw);
        validateBundle(bundle);
    } catch (e) {
        process.stderr.write(`aura-verify: invalid bundle: ${e.message}\n`);
        process.exit(2);
    }

    const registeredPolicies = new Set(bundle.session.registered_policy_versions || []);
    const suite = await runConformanceSuite({
        decisions: bundle.session.decisions,
        registeredPolicies,
    });
    // Strip the heavy session_verification detail for a clean CLI JSON output.
    const output = { ...suite, session_verification: undefined };

    if (asJson) {
        process.stdout.write(JSON.stringify(output, null, 2) + "\n");
    } else {
        process.stdout.write(formatHuman(suite, bundle));
    }

    process.exit(suite.overall === STATUS.PASS ? 0 : 1);
}

main().catch((e) => {
    process.stderr.write(`aura-verify: unexpected error: ${e.stack || e.message}\n`);
    process.exit(2);
});
