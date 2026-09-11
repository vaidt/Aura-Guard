/**
 * Aura-Guard — Binding Matrix loader.
 *
 * Loads the machine-readable Protocol → Implementation Binding Matrix from
 * /app/docs/binding_matrix.json. Used by the Conformance Core to wire each
 * check function to its normative-shaped invariant row.
 *
 * ESM JSON import is done via top-level fetch of the file contents from disk
 * (Node) or a pre-embedded copy (browser). To keep this module portable in
 * both environments and to avoid a build-tool-specific import assertion, we
 * embed the matrix inline. The embedded copy is validated to be byte-equal to
 * the JSON on disk by `frontend/tests/bindingMatrix.test.mjs`.
 */

export const BINDING_MATRIX = {
    matrix_version: "1.0",
    protocol_version: "unspecified",
    status: "implementation-level",
    invariants: [
        { id: "INV-STR-01",  impl_check_id: "impl:evidence-structure",     check_function: "checkEvidenceStructure",     requirement_ids: ["REQ-STR-01","REQ-STR-02"],                    status: "IMPLEMENTED" },
        { id: "INV-CAN-01",  impl_check_id: "impl:canonical-representation", check_function: "checkCanonicalRepresentation", requirement_ids: ["REQ-CAN-01","REQ-CAN-02"],                status: "IMPLEMENTED" },
        { id: "INV-HASH-01", impl_check_id: "impl:hash-integrity",          check_function: "checkSha256Integrity",       requirement_ids: ["REQ-HASH-01"],                                status: "IMPLEMENTED" },
        { id: "INV-CHN-01",  impl_check_id: "impl:chain-continuity",        check_function: "checkChainContinuity",       requirement_ids: ["REQ-CHN-01","REQ-CHN-02","REQ-CHN-03"],       status: "IMPLEMENTED" },
        { id: "INV-POL-01",  impl_check_id: "impl:policy-binding",          check_function: "checkPolicyBinding",         requirement_ids: ["REQ-POL-01"],                                 status: "IMPLEMENTED" },
        { id: "INV-TMP-01",  impl_check_id: "impl:tamper-detection",        check_function: "checkTamperDetection",       requirement_ids: ["REQ-TMP-01"],                                 status: "IMPLEMENTED" },
        { id: "INV-POR-01",  impl_check_id: "impl:evidence-portability",    check_function: "checkEvidencePortability",   requirement_ids: ["REQ-POR-01"],                                 status: "IMPLEMENTED" },
        { id: "INV-XIM-01",  impl_check_id: "impl:cross-implementation",    check_function: "checkCrossImplementation",   requirement_ids: ["REQ-XIM-01"],                                 status: "NOT_IMPLEMENTED_AT_RUNTIME" },
        { id: "INV-ATT-01",  impl_check_id: "impl:attestation-signature",   check_function: "checkAttestationSignature",  requirement_ids: ["REQ-ATT-01"],                                 status: "NOT_IMPLEMENTED" },
        { id: "INV-FLT-01",  impl_check_id: null,                            check_function: null,                          requirement_ids: ["REQ-FLT-01"],                                 status: "NOT_IMPLEMENTED" },
    ],
};

/** Look up an invariant by its `impl:*` id. Returns null for declared gaps. */
export function invariantForCheckId(implCheckId) {
    return BINDING_MATRIX.invariants.find((r) => r.impl_check_id === implCheckId) || null;
}
