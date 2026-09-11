#!/usr/bin/env node
/**
 * aura-sign — attach an INV-ATT-01 attestation to an Aura-Guard bundle.
 *
 * Usage: aura-sign <bundle.json> [--out <path>] [--key-id <id>] [--priv-hex <hex>]
 * Default key: DEMO_KEY_ID from /app/cli/demo-keys.mjs.
 * Exit codes: 0 signed · 2 bad input.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPrivateKey, sign as nodeSign, webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const HERE = new URL(".", import.meta.url).pathname;
const { buildAttestationPayload, canonicalPayloadString, ATTESTATION_VERSION, hexToBytes, bytesToHex, deriveFinalChainHash } =
    await import(resolve(HERE, "../frontend/src/lib/attestation.js"));
const { DEMO_KEY_ID, DEMO_PRIVATE_KEY_HEX } = await import("./demo-keys.mjs");

function usage() {
    process.stderr.write(
        "Usage: aura-sign <bundle.json> [--out <path>] [--key-id <id>] [--priv-hex <hex>] [--signed-at <ISO8601>]\n"
    );
}

function parseArgs(argv) {
    const args = { positional: [], out: null, key_id: DEMO_KEY_ID, priv_hex: DEMO_PRIVATE_KEY_HEX, signed_at: null };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--out") args.out = argv[++i];
        else if (a === "--key-id") args.key_id = argv[++i];
        else if (a === "--priv-hex") args.priv_hex = argv[++i];
        else if (a === "--signed-at") args.signed_at = argv[++i];
        else if (a === "-h" || a === "--help") { usage(); process.exit(2); }
        else args.positional.push(a);
    }
    if (args.positional.length !== 1) { usage(); process.exit(2); }
    return args;
}

function ed25519PrivateKeyFromRaw(rawHex) {
    const raw = hexToBytes(rawHex);
    if (raw.length !== 32) throw new Error("private key must be 32 bytes (64 hex chars)");
    // Wrap raw 32-byte seed in a minimal PKCS8 envelope for Ed25519.
    const pkcs8 = Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.from(raw)]);
    return createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" });
}

const { positional, out, key_id, priv_hex, signed_at } = parseArgs(process.argv.slice(2));
const inPath = resolve(process.cwd(), positional[0]);
const outPath = out ? resolve(process.cwd(), out) : inPath;

let bundle;
try {
    bundle = JSON.parse(readFileSync(inPath, "utf8"));
} catch (e) {
    process.stderr.write(`aura-sign: cannot read bundle: ${e.message}\n`);
    process.exit(2);
}
if (!bundle || bundle.bundle_version !== 1 || !bundle.session || !Array.isArray(bundle.session.decisions)) {
    process.stderr.write("aura-sign: bundle is not a valid Aura-Guard bundle (bundle_version=1 + session.decisions[]).\n");
    process.exit(2);
}

const when = signed_at || new Date().toISOString();
const payload = await buildAttestationPayload({ session: bundle.session, decisions: bundle.session.decisions, key_id, signed_at: when });
const signed_payload = canonicalPayloadString(payload);
const privKey = ed25519PrivateKeyFromRaw(priv_hex);
const sigBuf = nodeSign(null, Buffer.from(signed_payload, "utf8"), privKey);
const signature = bytesToHex(new Uint8Array(sigBuf));

bundle.attestation = {
    attestation_version: ATTESTATION_VERSION,
    algorithm: "ed25519",
    key_id,
    signed_at: when,
    signed_payload,
    signature,
};

writeFileSync(outPath, JSON.stringify(bundle, null, 2));
process.stdout.write(`aura-sign: attested with ${key_id} @ ${when} → ${outPath}\n`);
