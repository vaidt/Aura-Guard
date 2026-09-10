/**
 * Safe field helpers so the UI never crashes on partial/imported records.
 * These NEVER mutate the underlying audit schema — they only guard the render layer.
 */

export const DASH = "—";

export function safeString(v) {
    if (v === null || v === undefined) return "";
    if (typeof v === "string") return v;
    return String(v);
}

/** e.g. "credit_application_review" -> "credit application review" */
export function humanize(v) {
    const s = safeString(v);
    if (!s) return DASH;
    return s.replace(/_/g, " ");
}

/** For hash previews. Returns DASH when input is missing. */
export function truncHash(hash, len = 16) {
    const s = safeString(hash);
    if (!s) return DASH;
    return s.length > len ? `${s.slice(0, len)}…` : s;
}

export function hasFullEvidence(decision) {
    const e = decision?.evidence;
    return !!(
        e &&
        typeof e.canonical_hash === "string" &&
        typeof e.chain_hash === "string" &&
        typeof e.prev_hash === "string"
    );
}
