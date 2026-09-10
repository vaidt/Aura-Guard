/**
 * Evidence bundle export.
 *
 * Rule: preserve the imported audit evidence exactly as-imported.
 *   - No renaming, reordering (beyond deterministic JSON serialization), or
 *     invention of fields.
 *   - Session metadata is passed through unchanged.
 *   - Decisions: if the imported session already carried evidence, that
 *     evidence is preserved verbatim. If the session was loaded from a source
 *     that did not carry evidence (e.g. the built-in sample), the deterministic
 *     evidence synthesized at load time is exported alongside the decisions —
 *     since that IS the current canonical state of the session in this
 *     demonstrator.
 */

export function buildEvidenceBundle({ rawSession, decisions, importedHadEvidence, generatedAt }) {
    // Preserve the original session shape exactly; only replace the decisions array
    // (which is what the app displays and verifies against).
    const bundle = {
        ...rawSession,
        decisions,
    };

    // Attach a small, non-invasive export envelope so archival readers can
    // distinguish an as-imported bundle from a synthesized one WITHOUT altering
    // the underlying audit fields.
    return {
        bundle_version: 1,
        exported_at: generatedAt || new Date().toISOString(),
        source: importedHadEvidence ? "imported" : "synthesized-from-source",
        note: "Aura-Guard demonstrator export. Not a certified compliance artifact.",
        session: bundle,
    };
}

export function downloadJson(filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
