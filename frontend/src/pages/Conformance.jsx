import React, { useEffect, useState } from "react";
import { useAudit } from "@/context/AuditContext";
import { runConformanceSuite, PROTOCOL_VERSION, VERIFIER_VERSION, BUNDLE_VERSION, BINDING_MATRIX_VERSION, STATUS } from "@/lib/conformanceCore";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function statusClass(s) {
    switch (s) {
        case STATUS.PASS:
            return "border-emerald-700 bg-emerald-500/10 text-emerald-400";
        case STATUS.FAIL:
            return "border-red-700 bg-red-500/10 text-red-400";
        case STATUS.NOT_IMPLEMENTED:
            return "border-zinc-700 bg-zinc-800/40 text-zinc-400";
        case STATUS.NOT_APPLICABLE:
            return "border-zinc-700 bg-zinc-800/40 text-zinc-500";
        default:
            return "border-zinc-700 bg-zinc-800/40 text-zinc-400";
    }
}

export default function Conformance() {
    const { decisions, registeredPolicies } = useAudit();
    const [suite, setSuite] = useState(null);

    useEffect(() => {
        if (!decisions.length) return;
        let cancelled = false;
        runConformanceSuite({ decisions, registeredPolicies }).then((s) => {
            if (!cancelled) setSuite(s);
        });
        return () => { cancelled = true; };
    }, [decisions, registeredPolicies]);

    return (
        <div className="space-y-8">
            <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 font-mono">
                    Conformance core
                </div>
                <h1 className="mt-1 font-display text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-50">
                    Conformance suite
                </h1>
                <p className="text-sm text-zinc-400 mt-2 max-w-2xl">
                    Structured, machine-readable results from the implementation-level Conformance Core. Every emitted test is wired to a row in the <a href="/docs/BINDING_MATRIX.md" className="underline text-zinc-200 hover:text-white">Protocol → Implementation Binding Matrix</a> and carries its <span className="font-mono text-zinc-300">invariant_id</span> + <span className="font-mono text-zinc-300">requirement_ids</span>. Unimplemented capabilities are reported honestly as <span className="font-mono text-zinc-300">NOT IMPLEMENTED</span>.
                </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                <Meta label="protocol_version" value={PROTOCOL_VERSION} />
                <Meta label="verifier_version" value={VERIFIER_VERSION} />
                <Meta label="bundle_version" value={String(BUNDLE_VERSION)} />
                <Meta label="binding_matrix_version" value={String(BINDING_MATRIX_VERSION)} />
                <Meta label="record_count" value={String(decisions.length)} />
            </div>

            <Card className={`rounded-md border ${
                suite?.overall === STATUS.PASS
                    ? "bg-emerald-500/[0.04] border-emerald-800/60"
                    : suite?.overall === STATUS.FAIL
                    ? "bg-red-500/[0.05] border-red-800/60"
                    : "bg-zinc-900/60 border-zinc-800"
            }`} data-testid="conformance-overall-card">
                <CardContent className="p-5 flex items-center justify-between">
                    <div>
                        <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 font-mono">
                            Overall
                        </div>
                        <div className={`font-display text-2xl font-semibold mt-1 ${
                            suite?.overall === STATUS.PASS ? "text-emerald-400"
                                : suite?.overall === STATUS.FAIL ? "text-red-400" : "text-zinc-300"
                        }`}>
                            {suite?.overall || "Running…"}
                        </div>
                    </div>
                    <Badge variant="outline" className={`rounded-sm font-mono text-[11px] px-2 py-0.5 uppercase tracking-wider ${statusClass(suite?.overall)}`} data-testid="conformance-overall-badge">
                        {suite?.overall || "…"}
                    </Badge>
                </CardContent>
            </Card>

            <div className="rounded-md border border-zinc-800 bg-zinc-900/40 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="conformance-table">
                        <thead>
                            <tr className="bg-zinc-950/50 text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-mono">
                                <th className="text-left py-3 px-4 font-normal">Invariant</th>
                                <th className="text-left py-3 px-4 font-normal">Test ID</th>
                                <th className="text-left py-3 px-4 font-normal">Label</th>
                                <th className="text-left py-3 px-4 font-normal">Requirements</th>
                                <th className="text-left py-3 px-4 font-normal">Message</th>
                                <th className="text-left py-3 px-4 font-normal">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/70">
                            {(suite?.tests || []).map((t) => (
                                <tr key={t.id} data-testid={`conformance-row-${t.id}`}>
                                    <td className="py-3 px-4 font-mono text-xs text-zinc-200" data-testid={`conformance-invariant-${t.id}`}>{t.invariant_id || "—"}</td>
                                    <td className="py-3 px-4 font-mono text-xs text-zinc-400">{t.id}</td>
                                    <td className="py-3 px-4 text-zinc-200">{t.label}</td>
                                    <td className="py-3 px-4 font-mono text-[10px] text-zinc-400" data-testid={`conformance-requirements-${t.id}`}>
                                        {(t.requirement_ids || []).join(", ") || "—"}
                                    </td>
                                    <td className="py-3 px-4 text-xs text-zinc-400 max-w-md">{t.message}</td>
                                    <td className="py-3 px-4">
                                        <Badge variant="outline" className={`rounded-sm font-mono text-[10px] px-2 py-0.5 uppercase tracking-wider ${statusClass(t.status)}`} data-testid={`conformance-status-${t.id}`}>
                                            {t.status}
                                        </Badge>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="rounded-md border border-zinc-800 bg-zinc-950 p-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 font-mono mb-2">
                    Machine-readable output
                </div>
                <pre className="font-mono text-[10px] leading-relaxed text-zinc-400 overflow-x-auto" data-testid="conformance-json">
{JSON.stringify(suite ? { ...suite, session_verification: undefined } : { status: "running" }, null, 2)}
                </pre>
            </div>
        </div>
    );
}

function Meta({ label, value }) {
    return (
        <div className="rounded-sm border border-zinc-800 bg-zinc-900/40 p-3">
            <div className="text-[9px] uppercase tracking-[0.22em] text-zinc-500 font-mono">{label}</div>
            <div className="mt-1 font-mono text-xs text-zinc-200 break-all">{value}</div>
        </div>
    );
}
