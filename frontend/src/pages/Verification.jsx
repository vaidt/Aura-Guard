import React from "react";
import { useAudit } from "@/context/AuditContext";
import { Card, CardContent } from "@/components/ui/card";
import { PassFailBadge } from "@/components/StatusBadge";
import { CheckCircle2, XCircle } from "lucide-react";
import HashChainDiagram from "@/components/HashChainDiagram";

export default function Verification() {
    const { decisions, verification } = useAudit();

    if (!verification) {
        return (
            <div className="text-zinc-400 text-sm">Computing verification…</div>
        );
    }

    const summary = verification.results.reduce(
        (acc, r) => {
            acc.total++;
            if (r.pass) acc.pass++;
            Object.entries(r.checks).forEach(([k, v]) => {
                acc.checkPass[k] = (acc.checkPass[k] || 0) + (v.pass ? 1 : 0);
            });
            return acc;
        },
        { total: 0, pass: 0, checkPass: {} }
    );

    const allChecks = [
        { key: "canonical_representation", label: "Canonical representation" },
        { key: "sha256_integrity", label: "SHA-256 integrity" },
        { key: "hash_chain_continuity", label: "Hash-chain continuity" },
        { key: "policy_version", label: "Policy version" },
    ];

    return (
        <div className="space-y-8">
            <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 font-mono">
                    Evidence verification
                </div>
                <h1 className="mt-1 font-display text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-50">
                    Cryptographic checks
                </h1>
                <p className="text-sm text-zinc-400 mt-2 max-w-2xl">
                    For every decision the auditor re-derives the canonical representation, re-hashes it with SHA-256, verifies hash-chain continuity to the previous record and confirms the policy version is registered.
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {allChecks.map(({ key, label }) => {
                    const pass = summary.checkPass[key] || 0;
                    const ok = pass === summary.total;
                    return (
                        <Card
                            key={key}
                            className={`rounded-md border ${ok ? "bg-emerald-500/[0.04] border-emerald-800/60" : "bg-red-500/[0.05] border-red-800/60"}`}
                            data-testid={`check-summary-${key}`}
                        >
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                    <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 font-mono">{label}</div>
                                    {ok ? (
                                        <CheckCircle2 className="h-4 w-4 text-emerald-400" strokeWidth={1.75} />
                                    ) : (
                                        <XCircle className="h-4 w-4 text-red-400" strokeWidth={1.75} />
                                    )}
                                </div>
                                <div className={`mt-3 font-display text-3xl font-semibold tabular-nums ${ok ? "text-emerald-400" : "text-red-400"}`}>
                                    {pass}/{summary.total}
                                </div>
                                <div className="mt-1 text-xs text-zinc-500">records passing</div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            <HashChainDiagram decisions={decisions} verification={verification} />

            <Card className="bg-zinc-900/40 border border-zinc-800 rounded-md overflow-hidden">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm" data-testid="verification-table">
                            <thead>
                                <tr className="bg-zinc-950/50 text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-mono">
                                    <th className="text-left py-3 px-4 font-normal">Decision</th>
                                    {allChecks.map((c) => (
                                        <th key={c.key} className="text-left py-3 px-4 font-normal">{c.label}</th>
                                    ))}
                                    <th className="text-left py-3 px-4 font-normal">Overall</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/70">
                                {verification.results.map((r) => {
                                    const decision = decisions.find((d) => d.id === r.id);
                                    return (
                                        <tr key={r.id} data-testid={`verify-row-${r.id}`} className="hover:bg-zinc-900/60">
                                            <td className="py-3 px-4 font-mono text-xs text-zinc-300">
                                                {r.id}
                                                <div className="text-[10px] text-zinc-500">{decision?.policy_version}</div>
                                            </td>
                                            {allChecks.map((c) => (
                                                <td key={c.key} className="py-3 px-4" data-testid={`check-${r.id}-${c.key}`}>
                                                    <PassFailBadge pass={r.checks[c.key].pass} />
                                                    <div className="text-[10px] text-zinc-500 mt-1 max-w-[220px]">{r.checks[c.key].detail}</div>
                                                </td>
                                            ))}
                                            <td className="py-3 px-4">
                                                <PassFailBadge pass={r.pass} testid={`overall-${r.id}`} />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
