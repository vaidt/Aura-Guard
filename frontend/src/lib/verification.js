/**
 * Deterministic verification logic for Aura-Guard demonstrator.
 *
 * NOTE: This module is intentionally isolated so it can later be replaced
 * with the normative Aura Protocol implementation without touching the UI.
 *
 * - canonicalize(): RFC-8785-flavoured JCS-lite canonicalization
 *   (sorted object keys, no insignificant whitespace, deterministic array order).
 *   NOTE (R2): storing `canonical_representation` inside evidence is an
 *   IMPLEMENTATION-DEFINED choice at this stage, PENDING the normative Aura
 *   Protocol specification. See /app/docs/BUNDLE_SCHEMA.md.
 * - sha256Hex(): SHA-256 hash via the browser SubtleCrypto API.
 * - buildHashChain(): computes canonical hash + chained hash for each decision.
 * - verifyDecision(): re-derives hashes and compares to the stored evidence.
 */

const GENESIS_HASH = "0".repeat(64);

/**
 * Deterministically canonicalize a JSON-serializable value.
 * - Object keys sorted lexicographically.
 * - Arrays preserved in-order (order is semantic in audit logs).
 * - No whitespace.
 * - Strings JSON.stringify-encoded (proper escapes).
 */
export function canonicalize(value) {
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return "[" + value.map((v) => canonicalize(v)).join(",") + "]";
    }
    const keys = Object.keys(value).sort();
    return (
        "{" +
        keys
            .map((k) => JSON.stringify(k) + ":" + canonicalize(value[k]))
            .join(",") +
        "}"
    );
}

/** SHA-256 of a UTF-8 string → hex. */
export async function sha256Hex(str) {
    const bytes = new TextEncoder().encode(str);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

/** Extract the payload used to compute the canonical hash (exclude the evidence block). */
function decisionPayload(decision) {
    // eslint-disable-next-line no-unused-vars
    const { evidence, ...payload } = decision;
    return payload;
}

/**
 * Compute canonical hash + hash-chain for a list of decisions.
 * Assumes decisions are in append order (chronological).
 * Overwrites .evidence.canonical_hash, .evidence.prev_hash, .evidence.chain_hash.
 */
export async function buildHashChain(decisions) {
    let prev = GENESIS_HASH;
    const out = [];
    for (const d of decisions) {
        const payload = decisionPayload(d);
        const canonical = canonicalize(payload);
        const canonical_hash = await sha256Hex(canonical);
        const chain_input = prev + canonical_hash;
        const chain_hash = await sha256Hex(chain_input);
        out.push({
            ...d,
            evidence: {
                ...(d.evidence || {}),
                canonical_representation: canonical,
                canonical_hash,
                prev_hash: prev,
                chain_hash,
                policy_version: d.policy_version,
            },
        });
        prev = chain_hash;
    }
    return out;
}

/**
 * Verify a single decision against expected checks.
 * Returns per-check PASS/FAIL and an overall verdict.
 *
 * prevChainHash: the chain_hash of the previous decision (or GENESIS for index 0).
 * expectedPolicyVersions: set of allowed/registered policy versions.
 */
export async function verifyDecision(decision, prevChainHash, expectedPolicyVersions) {
    const evidence = decision.evidence || {};
    const payload = decisionPayload(decision);
    const canonical = canonicalize(payload);
    const canonicalMatches = canonical === evidence.canonical_representation;

    const recomputedHash = await sha256Hex(canonical);
    const integrityMatches = recomputedHash === evidence.canonical_hash;

    const prevMatches = evidence.prev_hash === prevChainHash;
    const recomputedChain = await sha256Hex(prevChainHash + recomputedHash);
    const chainMatches = recomputedChain === evidence.chain_hash;

    const policyOk =
        !!decision.policy_version &&
        expectedPolicyVersions.has(decision.policy_version);

    const checks = {
        canonical_representation: {
            pass: canonicalMatches,
            label: "Canonical representation",
            detail: canonicalMatches
                ? "Payload re-canonicalized identically to stored evidence."
                : "Re-canonicalized payload differs from stored evidence.",
        },
        sha256_integrity: {
            pass: integrityMatches,
            label: "SHA-256 integrity",
            detail: integrityMatches
                ? `Recomputed SHA-256 matches stored canonical_hash.`
                : `Recomputed hash ${recomputedHash.slice(0, 12)}… does NOT match ${String(
                      evidence.canonical_hash || ""
                  ).slice(0, 12)}…`,
        },
        hash_chain_continuity: {
            pass: prevMatches && chainMatches,
            label: "Hash-chain continuity",
            detail:
                prevMatches && chainMatches
                    ? "prev_hash and chain_hash link correctly to the previous record."
                    : !prevMatches
                    ? "prev_hash does not link to the previous record."
                    : "chain_hash does not equal SHA-256(prev_hash || canonical_hash).",
        },
        policy_version: {
            pass: policyOk,
            label: "Policy version",
            detail: policyOk
                ? `Policy ${decision.policy_version} is registered.`
                : `Policy ${decision.policy_version || "n/a"} is NOT in the registered set.`,
        },
    };

    const pass = Object.values(checks).every((c) => c.pass);
    return { pass, checks, recomputedHash, recomputedChain };
}

/** Verify an entire session; returns per-decision result and aggregate. */
export async function verifySession(decisions, expectedPolicyVersions) {
    let prev = GENESIS_HASH;
    const results = [];
    for (const d of decisions) {
        const r = await verifyDecision(d, prev, expectedPolicyVersions);
        results.push({ id: d.id, ...r });
        // Chain semantics: the auditor recomputes the previous row's chain hash
        // and expects the next row's prev_hash to link to THAT — so tampering
        // any record causes a cascading failure through every subsequent link.
        prev = r.recomputedChain;
    }
    const allPass = results.every((r) => r.pass);
    return { allPass, results };
}
