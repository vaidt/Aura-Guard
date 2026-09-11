/**
 * INV-ATT-01 — Attestation payload build + Ed25519 sign/verify.
 *
 * See /app/docs/INV_ATT_01_ATTESTATION_SIGNATURE.md for the spec.
 */

import { canonicalize, verifySession } from "./verification.js";
import { DEFAULT_SIGNING_KEY_REGISTRY, findKey } from "./signingKeys.js";

export const ATTESTATION_VERSION = "1.0";
const GENESIS = "0".repeat(64);

// ---------- byte helpers ----------

export function hexToBytes(hex) {
    if (typeof hex !== "string" || hex.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(hex)) {
        throw new Error("hexToBytes: invalid hex string");
    }
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(2 * i, 2 * i + 2), 16);
    return out;
}
export function bytesToHex(bytes) {
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- canonical payload ----------

/**
 * Derive the CANONICAL final chain hash by re-verifying the decisions.
 * Ties the attestation to the re-derived chain, not to potentially-tampered
 * stored evidence — that's the correct third-party-attestation semantic.
 */
export async function deriveFinalChainHash(decisions, registeredPolicies) {
    if (!Array.isArray(decisions) || decisions.length === 0) return GENESIS;
    const v = await verifySession(decisions, registeredPolicies || new Set());
    return v.results[v.results.length - 1].recomputedChain;
}

/**
 * Derive the exact object the signer MUST sign for a given bundle context.
 * Uses re-derived final_chain_hash unless one is supplied explicitly (test hook).
 */
export async function buildAttestationPayload(ctx) {
    const { session, decisions, key_id, signed_at, final_chain_hash } = ctx;
    if (!key_id) throw new Error("buildAttestationPayload: key_id required");
    if (!signed_at) throw new Error("buildAttestationPayload: signed_at required");
    const fch = final_chain_hash != null
        ? final_chain_hash
        : await deriveFinalChainHash(decisions, new Set(session?.registered_policy_versions || []));
    const registered = [...(session?.registered_policy_versions || [])].sort();
    return {
        algorithm: "ed25519",
        aura_attestation_version: ATTESTATION_VERSION,
        bundle_version: 1,
        final_chain_hash: fch,
        genesis_hash: GENESIS,
        key_id,
        record_count: decisions.length,
        registered_policy_versions: registered,
        session_id: session?.session_id || "",
        signed_at,
    };
}

export function canonicalPayloadString(payload) {
    return canonicalize(payload);
}

// ---------- Ed25519 primitives (WebCrypto with Node-webcrypto fallback) ----------

async function edVerifyRaw(publicKeyRaw32, message, signature64) {
    const subtle = (globalThis.crypto && globalThis.crypto.subtle) || null;
    if (!subtle) throw new Error("Ed25519 verify: no SubtleCrypto available");
    // Chrome/Safari/Firefox/Node webcrypto all accept 'Ed25519' + raw 32B.
    const key = await subtle.importKey("raw", publicKeyRaw32, { name: "Ed25519" }, false, ["verify"]);
    return await subtle.verify({ name: "Ed25519" }, key, signature64, message);
}

export async function ed25519VerifyHex(publicKeyHex, messageBytes, signatureHex) {
    const pub = hexToBytes(publicKeyHex);
    const sig = hexToBytes(signatureHex);
    if (pub.length !== 32) throw new Error("Ed25519: public key must be 32 bytes");
    if (sig.length !== 64) throw new Error("Ed25519: signature must be 64 bytes");
    return await edVerifyRaw(pub, messageBytes, sig);
}

// ---------- signing (env-agnostic; WebCrypto Ed25519) ----------

function _b64u(bytes) {
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    // btoa is available in Node ≥16 globals and every browser.
    const b64 = (typeof btoa === "function" ? btoa(bin) : Buffer.from(bytes).toString("base64"));
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function ed25519SignRaw(privateKeyRaw32, publicKeyRaw32, message) {
    const subtle = globalThis.crypto && globalThis.crypto.subtle;
    if (!subtle) throw new Error("Ed25519 sign: no SubtleCrypto available");
    const jwk = { kty: "OKP", crv: "Ed25519", d: _b64u(privateKeyRaw32), x: _b64u(publicKeyRaw32) };
    const key = await subtle.importKey("jwk", jwk, { name: "Ed25519" }, false, ["sign"]);
    return new Uint8Array(await subtle.sign({ name: "Ed25519" }, key, message));
}

/**
 * Sign a canonical payload with the demo signing key.
 * @param {object} params {session, decisions, key_id, priv_hex, pub_hex, signed_at}
 * @returns {Promise<object>} bundle.attestation block
 */
export async function signAttestation({ session, decisions, key_id, priv_hex, pub_hex, signed_at }) {
    const when = signed_at || new Date().toISOString();
    const payload = await buildAttestationPayload({ session, decisions, key_id, signed_at: when });
    const signed_payload = canonicalPayloadString(payload);
    const priv = hexToBytes(priv_hex);
    const pub = hexToBytes(pub_hex);
    if (priv.length !== 32) throw new Error("signAttestation: private key must be 32 bytes");
    if (pub.length !== 32)  throw new Error("signAttestation: public key must be 32 bytes");
    const sigBytes = await ed25519SignRaw(priv, pub, new TextEncoder().encode(signed_payload));
    return {
        attestation_version: ATTESTATION_VERSION,
        algorithm: "ed25519",
        key_id,
        signed_at: when,
        signed_payload,
        signature: bytesToHex(sigBytes),
    };
}

// ---------- verification ----------

/**
 * Verify an attestation block against the bundle it claims to attest.
 *
 * @param {object} params
 * @param {object} params.attestation      - Bundle.attestation block.
 * @param {object} params.session          - Bundle.session.
 * @param {Array}  params.decisions        - Session decisions.
 * @param {Array}  [params.registry]       - Trusted key registry (defaults to DEFAULT_SIGNING_KEY_REGISTRY).
 * @returns {Promise<{pass:boolean, code:string, detail:string, key_id?:string, signed_at?:string}>}
 */
export async function verifyAttestation({ attestation, session, decisions, registry = DEFAULT_SIGNING_KEY_REGISTRY }) {
    if (!attestation || typeof attestation !== "object") {
        return { pass: false, code: "no_attestation", detail: "No attestation block." };
    }
    const { attestation_version, algorithm, key_id, signed_at, signed_payload, signature } = attestation;
    if (attestation_version !== ATTESTATION_VERSION) {
        return { pass: false, code: "unsupported_version", detail: `Unsupported attestation_version: ${attestation_version}` };
    }
    if (algorithm !== "ed25519") {
        return { pass: false, code: "unsupported_algorithm", detail: `Unsupported algorithm: ${algorithm}` };
    }
    if (!key_id || !signed_at || typeof signed_payload !== "string" || typeof signature !== "string") {
        return { pass: false, code: "malformed_attestation", detail: "attestation is missing required fields." };
    }

    const entry = findKey(registry, key_id);
    if (!entry) return { pass: false, code: "unknown_key", detail: `key_id ${key_id} is not in the trusted registry.` };
    if (entry.status === "revoked") return { pass: false, code: "revoked_key", detail: `key_id ${key_id} is revoked.` };
    if (entry.algorithm !== "ed25519") return { pass: false, code: "algorithm_mismatch", detail: `Registry key ${key_id} algorithm=${entry.algorithm}, attestation algorithm=${algorithm}.` };

    const ts = Date.parse(signed_at);
    const from = Date.parse(entry.valid_from);
    const until = Date.parse(entry.valid_until);
    if (!Number.isFinite(ts) || !Number.isFinite(from) || !Number.isFinite(until)) {
        return { pass: false, code: "bad_timestamp", detail: "signed_at or key validity window is not RFC 3339." };
    }
    if (ts < from || ts > until) {
        return { pass: false, code: "out_of_window", detail: `signed_at=${signed_at} is outside [${entry.valid_from},${entry.valid_until}] for ${key_id}.` };
    }

    // Reconstruct expected payload from bundle + attestation metadata and
    // compare canonical bytes byte-for-byte. Uses re-derived final chain hash.
    const expected = await buildAttestationPayload({ session, decisions, key_id, signed_at });
    const expectedCanonical = canonicalPayloadString(expected);
    if (expectedCanonical !== signed_payload) {
        return { pass: false, code: "payload_mismatch", detail: "Reconstructed canonical payload does not match attestation.signed_payload." };
    }

    // Verify Ed25519 signature over UTF-8(signed_payload).
    const msg = new TextEncoder().encode(signed_payload);
    let ok = false;
    try {
        ok = await ed25519VerifyHex(entry.public_key_hex, msg, signature);
    } catch (e) {
        return { pass: false, code: "verify_error", detail: `Ed25519 verify threw: ${e.message}` };
    }
    if (!ok) return { pass: false, code: "bad_signature", detail: `Ed25519 signature does not verify against ${key_id}.` };

    return { pass: true, code: "verified", detail: `Attested by ${key_id} at ${signed_at}.`, key_id, signed_at };
}
