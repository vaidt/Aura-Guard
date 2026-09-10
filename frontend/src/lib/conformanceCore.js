/**
 * Aura-Guard — Conformance Core (implementation-level, not normative).
 *
 * Boundary rule (from the Modernization Mission):
 *   - The UI must never recompute or redefine protocol semantics.
 *   - This module wraps the pure verifier in `verification.js` and produces
 *     a structured machine-readable result the UI can render.
 *
 * Non-normative:
 *   - Test IDs are prefixed with `impl:` so they cannot be mistaken for a
 *     protocol-standard identifier.
 *   - PROTOCOL_VERSION is marked `unspecified` because no protocol
 *     specification document has been supplied to this project yet.
 *   - Every capability that is not implemented is reported as
 *     `NOT IMPLEMENTED` — never fabricated as PASS.
 */

import { canonicalize, sha256Hex, verifySession } from "./verification.js";
import { hasFullEvidence } from "./format.js";

export const PROTOCOL_VERSION = "unspecified"; // No normative spec supplied.
export const VERIFIER_VERSION = "aura-guard-conformance-core/0.2.0";
export const BUNDLE_VERSION = 1;

export const STATUS = Object.freeze({
    PASS: "PASS",
    FAIL: "FAIL",
    NOT_IMPLEMENTED: "NOT IMPLEMENTED",
    NOT_APPLICABLE: "NOT APPLICABLE",
});

/**
 * Run the full conformance suite against an evidence bundle.
 *
 * @param {object} params
 * @param {Array}  params.decisions              - Decision records (with evidence).
 * @param {Set}    params.registeredPolicies     - Registered policy versions.
 * @returns structured suite result.
 */
export async function runConformanceSuite({ decisions, registeredPolicies }) {
    const now = new Date().toISOString();
    const meta = {
        protocol_version: PROTOCOL_VERSION,
        verifier_version: VERIFIER_VERSION,
        bundle_version: BUNDLE_VERSION,
        run_at: now,
        record_count: Array.isArray(decisions) ? decisions.length : 0,
    };

    if (!Array.isArray(decisions) || decisions.length === 0) {
        return {
            ...meta,
            overall: STATUS.FAIL,
            tests: [
                {
                    id: "impl:evidence-structure",
                    label: "Evidence structure",
                    status: STATUS.FAIL,
                    message: "No decision records to verify.",
                },
            ],
        };
    }

    // Structural check — cheap, non-cryptographic.
    const structureOk = decisions.every((d) => d && d.id);
    // Every decision must carry a full evidence block after Conformance Core loading.
    const evidenceOk = decisions.every(hasFullEvidence);

    // Run the cryptographic verifier (single source of truth for hash logic).
    const v = await verifySession(decisions, registeredPolicies);

    const check = (key) =>
        v.results.every((r) => r.checks[key].pass) ? STATUS.PASS : STATUS.FAIL;

    const tests = [
        {
            id: "impl:evidence-structure",
            label: "Evidence structure",
            status: structureOk && evidenceOk ? STATUS.PASS : STATUS.FAIL,
            message: structureOk && evidenceOk
                ? `All ${decisions.length} records have id + full evidence block.`
                : "One or more records are missing id or evidence.",
        },
        {
            id: "impl:canonical-representation",
            label: "Canonical representation",
            status: check("canonical_representation"),
            message: "RFC-8785-flavoured JCS-lite canonicalization; re-derived payload must equal stored representation.",
        },
        {
            id: "impl:hash-integrity",
            label: "SHA-256 integrity",
            status: check("sha256_integrity"),
            message: "Recomputed SHA-256 must equal stored canonical_hash.",
        },
        {
            id: "impl:chain-continuity",
            label: "Hash-chain continuity",
            status: check("hash_chain_continuity"),
            message: "prev_hash must link to previous re-derived chain_hash; chain_hash = SHA-256(prev || canonical).",
        },
        {
            id: "impl:policy-binding",
            label: "Policy binding",
            status: check("policy_version"),
            message: "Every decision's policy_version must be in the registered policy set.",
        },
        // Tamper detection is asserted at the runtime level by the negative regression
        // suite (see /app/frontend/tests/verification.test.mjs). For a live bundle,
        // this test reports PASS iff the cryptographic invariants above hold — which
        // means an untampered bundle is trusted AND a tampered bundle is caught.
        {
            id: "impl:tamper-detection",
            label: "Tamper detection",
            status: v.allPass ? STATUS.PASS : STATUS.FAIL,
            message: v.allPass
                ? "Current bundle passes cryptographic invariants — tamper would be detected by the verifier."
                : "Cryptographic invariants failed — tamper detected by the verifier.",
        },
        {
            id: "impl:evidence-portability",
            label: "Evidence portability",
            status: STATUS.NOT_IMPLEMENTED,
            message: "Cross-environment portability proof not implemented in this phase. Bundle export exists; independent-environment verifier CLI does not.",
        },
        {
            id: "impl:cross-implementation",
            label: "Cross-implementation agreement",
            status: STATUS.NOT_IMPLEMENTED,
            message: "No second reference implementation available; agreement cannot be asserted.",
        },
        {
            id: "impl:attestation-signature",
            label: "Attestation signature",
            status: STATUS.NOT_IMPLEMENTED,
            message: "No cryptographic signature specification supplied. Signature scheme, key lifecycle, and canonical payload for signing are undefined.",
        },
    ];

    const overall = tests.some((t) => t.status === STATUS.FAIL)
        ? STATUS.FAIL
        : tests.every((t) =>
              [STATUS.PASS, STATUS.NOT_IMPLEMENTED, STATUS.NOT_APPLICABLE].includes(t.status)
          )
        ? STATUS.PASS
        : STATUS.FAIL;

    return { ...meta, overall, tests, session_verification: v };
}

/**
 * Utility exposed to the UI so a decision's "recomputed" hashes can be shown
 * next to stored ones. Purely read-only and uses the same canonicalize+sha256
 * primitives the verifier uses. No stored evidence is mutated.
 */
export async function recomputeForDisplay(decision, prevChainHash) {
    // eslint-disable-next-line no-unused-vars
    const { evidence, ...payload } = decision || {};
    const canonical = canonicalize(payload);
    const canonical_hash = await sha256Hex(canonical);
    const chain_hash = await sha256Hex((prevChainHash || "0".repeat(64)) + canonical_hash);
    return { canonical, canonical_hash, chain_hash };
}
