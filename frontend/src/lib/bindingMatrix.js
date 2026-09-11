/**
 * Aura-Guard — Binding Matrix loader.
 *
 * Code-side mirror of /app/docs/binding_matrix.json. Validated for row
 * identity by /app/frontend/tests/bindingMatrix.test.mjs.
 */

export const BINDING_MATRIX = {
    matrix_version: "1.1",
    protocol_version: "unspecified",
    status: "implementation-level",
    invariants: [
        { id: "INV-STR-01",  impl_check_id: "impl:evidence-structure",       check_function: "checkEvidenceStructure",       requirement_ids: ["REQ-STR-01","REQ-STR-02"],                 status: "IMPLEMENTED" },
        { id: "INV-CAN-01",  impl_check_id: "impl:canonical-representation", check_function: "checkCanonicalRepresentation", requirement_ids: ["REQ-CAN-01","REQ-CAN-02"],                 status: "IMPLEMENTED" },
        { id: "INV-HASH-01", impl_check_id: "impl:hash-integrity",           check_function: "checkSha256Integrity",         requirement_ids: ["REQ-HASH-01"],                             status: "IMPLEMENTED" },
        { id: "INV-CHN-01",  impl_check_id: "impl:chain-continuity",         check_function: "checkChainContinuity",         requirement_ids: ["REQ-CHN-01","REQ-CHN-02","REQ-CHN-03"],    status: "IMPLEMENTED" },
        { id: "INV-POL-01",  impl_check_id: "impl:policy-binding",           check_function: "checkPolicyBinding",           requirement_ids: ["REQ-POL-01"],                              status: "IMPLEMENTED" },
        { id: "INV-TMP-01",  impl_check_id: "impl:tamper-detection",         check_function: "checkTamperDetection",         requirement_ids: ["REQ-TMP-01"],                              status: "IMPLEMENTED" },
        { id: "INV-FLT-01",  impl_check_id: "impl:numeric-canonicalization", check_function: "checkNumericCanonicalization", requirement_ids: ["REQ-FLT-01"],                              status: "IMPLEMENTED" },
        { id: "INV-POR-01",  impl_check_id: "impl:evidence-portability",     check_function: "checkEvidencePortability",     requirement_ids: ["REQ-POR-01"],                              status: "IMPLEMENTED" },
        { id: "INV-XIM-01",  impl_check_id: "impl:cross-implementation",     check_function: "checkCrossImplementation",     requirement_ids: ["REQ-XIM-01"],                              status: "NOT_IMPLEMENTED_AT_RUNTIME" },
        { id: "INV-ATT-01",  impl_check_id: "impl:attestation-signature",    check_function: "checkAttestationSignature",    requirement_ids: ["REQ-ATT-01"],                              status: "NOT_IMPLEMENTED" },
    ],
};

/** Look up an invariant by its `impl:*` id. Returns null if not present. */
export function invariantForCheckId(implCheckId) {
    return BINDING_MATRIX.invariants.find((r) => r.impl_check_id === implCheckId) || null;
}
