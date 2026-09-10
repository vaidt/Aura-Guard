import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from "react";
import { SAMPLE_SESSION, REGISTERED_POLICY_VERSIONS } from "@/lib/sampleData";
import { buildHashChain, verifySession } from "@/lib/verification";
import { hasFullEvidence } from "@/lib/format";

const AuditContext = createContext(null);

/**
 * Validate the imported JSON shape defensively.
 * Throws with a user-facing message. Never mutates the input.
 */
export function validateSessionInput(parsed) {
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Session must be a JSON object.");
    }
    if (!Array.isArray(parsed.decisions)) {
        throw new Error("Session is missing a `decisions` array.");
    }
    for (const [i, d] of parsed.decisions.entries()) {
        if (!d || typeof d !== "object" || Array.isArray(d)) {
            throw new Error(`decisions[${i}] must be an object.`);
        }
        if (!d.id) {
            throw new Error(`decisions[${i}] is missing required field \`id\`.`);
        }
    }
    return true;
}

export function AuditProvider({ children }) {
    const [rawSession, setRawSession] = useState(null);
    const [session, setSession] = useState(null);
    const [decisions, setDecisions] = useState([]);
    const [tampered, setTampered] = useState(false);
    const [loading, setLoading] = useState(true);
    const [verification, setVerification] = useState(null);
    const importedHadEvidence = useRef(false);

    const registeredPolicies = useMemo(
        () => new Set(session?.registered_policy_versions || REGISTERED_POLICY_VERSIONS),
        [session]
    );

    const loadSession = useCallback(async (rawInput) => {
        setLoading(true);
        validateSessionInput(rawInput);

        // Deep-clone to avoid mutating caller's object.
        const raw = JSON.parse(JSON.stringify(rawInput));
        const allHaveEvidence = raw.decisions.length > 0 && raw.decisions.every(hasFullEvidence);
        importedHadEvidence.current = allHaveEvidence;

        // If evidence is already present on every record, preserve it verbatim.
        // Otherwise, synthesize a hash chain so the demo can verify + tamper.
        const chained = allHaveEvidence ? raw.decisions : await buildHashChain(raw.decisions);

        // Session metadata excludes decisions (which live in their own state slice).
        // eslint-disable-next-line no-unused-vars
        const { decisions: _dec, ...meta } = raw;

        setRawSession(raw);
        setSession(meta);
        setDecisions(chained);
        setTampered(false);
        setLoading(false);
    }, []);

    useEffect(() => {
        loadSession(SAMPLE_SESSION).catch((e) => {
            // eslint-disable-next-line no-console
            console.error("Sample session load failed:", e);
            setLoading(false);
        });
    }, [loadSession]);

    useEffect(() => {
        if (!decisions.length) {
            setVerification(null);
            return;
        }
        let cancelled = false;
        (async () => {
            const v = await verifySession(decisions, registeredPolicies);
            if (!cancelled) setVerification(v);
        })();
        return () => {
            cancelled = true;
        };
    }, [decisions, registeredPolicies]);

    const tamperDecision = useCallback((decisionId, field, newValue) => {
        setDecisions((prev) =>
            prev.map((d) => {
                if (d.id !== decisionId) return d;
                const copy = { ...d };
                if (field.startsWith("output.")) {
                    const key = field.split(".")[1];
                    copy.output = { ...(copy.output || {}), [key]: newValue };
                } else if (field.startsWith("input.")) {
                    const key = field.split(".")[1];
                    copy.input = { ...(copy.input || {}), [key]: newValue };
                } else {
                    copy[field] = newValue;
                }
                return copy;
            })
        );
        setTampered(true);
    }, []);

    const resetSession = useCallback(() => {
        loadSession(SAMPLE_SESSION);
    }, [loadSession]);

    const importSession = useCallback(
        async (parsed) => {
            await loadSession(parsed);
        },
        [loadSession]
    );

    const stats = useMemo(() => {
        const total = decisions.length;
        const compliant = decisions.filter((d) => d.policy_status === "compliant").length;
        const warnings = decisions.filter((d) => d.policy_status === "warning").length;
        const violations = decisions.filter((d) => d.policy_status === "violation").length;
        return { total, compliant, warnings, violations };
    }, [decisions]);

    const integrityOk = verification?.allPass ?? null;

    const value = {
        rawSession,
        session,
        decisions,
        stats,
        verification,
        integrityOk,
        tampered,
        loading,
        tamperDecision,
        resetSession,
        importSession,
        registeredPolicies,
        importedHadEvidence: importedHadEvidence.current,
    };

    return <AuditContext.Provider value={value}>{children}</AuditContext.Provider>;
}

export function useAudit() {
    const ctx = useContext(AuditContext);
    if (!ctx) throw new Error("useAudit must be used within AuditProvider");
    return ctx;
}
