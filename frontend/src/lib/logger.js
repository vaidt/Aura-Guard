/**
 * Minimal opt-in logger.
 *
 * Silent by default in the browser and Node. Enable ad-hoc by setting
 * `window.AURA_DEBUG = true` (browser) or `globalThis.AURA_DEBUG = true`
 * (Node). Keeps production console noise-free without hiding failures
 * behind a heavyweight logging framework.
 */
const enabled = () => {
    try {
        return typeof globalThis !== "undefined" && !!globalThis.AURA_DEBUG;
    } catch {
        return false;
    }
};

export const log = {
    warn: (...args) => { if (enabled()) console.warn(...args); },
    error: (...args) => { if (enabled()) console.error(...args); },
};
