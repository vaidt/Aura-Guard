/**
 * INV-ATT-01 — Trusted signing-key registry (JS mirror).
 *
 * MUST be kept byte-equal to /app/config/signing_keys.json. Validated in
 * /app/frontend/tests/attestation.test.mjs. The registry is OUT-OF-BAND
 * trust: it is never carried inside a bundle; verifiers consult this list
 * or an equivalent supplied externally.
 */

export const DEFAULT_SIGNING_KEY_REGISTRY = Object.freeze([
    Object.freeze({
        key_id: "aura-key-2026Q1-demo-001",
        algorithm: "ed25519",
        public_key_hex: "77b32cb4e8795e28e96a1f1621d73ed08e1903507434080a853e85d60f70ad06",
        status: "active",
        valid_from: "2026-01-01T00:00:00Z",
        valid_until: "2027-01-01T00:00:00Z",
        note: "DEMO KEY — do not use in production.",
    }),
    Object.freeze({
        key_id: "aura-key-2025-revoked-demo-001",
        algorithm: "ed25519",
        public_key_hex: "0000000000000000000000000000000000000000000000000000000000000000",
        status: "revoked",
        valid_from: "2025-01-01T00:00:00Z",
        valid_until: "2026-01-01T00:00:00Z",
        note: "DEMO REVOKED KEY — used by tests to prove revocation rejection.",
    }),
]);

export function findKey(registry, keyId) {
    return registry.find((k) => k.key_id === keyId) || null;
}
