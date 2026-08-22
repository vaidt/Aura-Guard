import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { SAMPLE_SESSION, REGISTERED_POLICY_VERSIONS } from "@/lib/sampleData";
import { buildHashChain, verifySession } from "@/lib/verification";

const AuditContext = createContext(null);

export function AuditProvider({ children }) {
    const [session, setSession] = useState(null);
    const [decisions, setDecisions] = useState([]);
    const [tampered, setTampered] = useState(false);
    const [loading, setLoading] = useState(true);
    const [verification, setVerification] = useState(null);

    const registeredPolicies = useMemo(
        () => new Set(session?.registered_policy_versions || REGISTERED_POLICY_VERSIONS),
        [session]
    );

    const loadSession = useCallback(async (rawSession) => {
        setLoading(true);
        const chained = await buildHashChain(rawSession.decisions);
        setSession({ ...rawSession, decisions: undefined });
        setDecisions(chained);
        setTampered(false);
        setLoading(false);
    }, []);

    useEffect(() => {
        loadSession(SAMPLE_SESSION);
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
                    copy.output = { ...copy.output, [key]: newValue };
                } else if (field.startsWith("input.")) {
                    const key = field.split(".")[1];
                    copy.input = { ...copy.input, [key]: newValue };
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
            if (!parsed || !Array.isArray(parsed.decisions)) {
                throw new Error("Invalid session: expected `decisions` array.");
            }
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
    };

    return <AuditContext.Provider value={value}>{children}</AuditContext.Provider>;
}

export function useAudit() {
    const ctx = useContext(AuditContext);
    if (!ctx) throw new Error("useAudit must be used within AuditProvider");
    return ctx;
}
