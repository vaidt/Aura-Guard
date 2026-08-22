import React from "react";
import { useAudit } from "@/context/AuditContext";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import StatusBadge, { PassFailBadge } from "@/components/StatusBadge";

export default function Report() {
    const { session, decisions, stats, verification, integrityOk, tampered } = useAudit();
    const generatedAt = new Date().toISOString();

    return (
        <div>
            <div className="no-print max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 font-mono">Compliance report</div>
                    <div className="font-display text-xl text-zinc-100">Ready for export / print</div>
                </div>
                <Button
                    className="rounded-sm bg-zinc-100 text-zinc-900 hover:bg-white"
                    onClick={() => window.print()}
                    data-testid="print-report-btn"
                >
                    <Printer className="h-4 w-4 mr-2" strokeWidth={2} /> Print / Save as PDF
                </Button>
            </div>

            <div className="print-page bg-white text-zinc-900 mx-auto max-w-4xl px-8 py-10 border border-zinc-800 print:border-none print:shadow-none rounded-md" data-testid="report-page">
                {/* Header */}
                <div className="border-b border-zinc-300 pb-6 mb-6">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-mono">
                                Aura-Guard · Compliance Auditor
                            </div>
                            <h1 className="mt-1 font-display text-3xl font-semibold text-zinc-900">
                                Compliance Audit Report
                            </h1>
                            <div className="mt-1 text-sm text-zinc-600">{session?.session_name}</div>
                        </div>
                        <div className="text-right text-[11px] text-zinc-500 font-mono">
                            <div>Report generated</div>
                            <div className="text-zinc-800">{generatedAt}</div>
                        </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-[11px] font-mono">
                        <MetaField label="Session ID" value={session?.session_id} />
                        <MetaField label="Organization" value={session?.organization} />
                        <MetaField label="Auditor" value={session?.auditor} />
                        <MetaField label="Records" value={String(stats.total)} />
                    </div>
                </div>

                {/* Executive summary */}
                <section className="mb-8">
                    <SectionTitle>1 · Executive summary</SectionTitle>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                        <SummaryTile label="Total decisions" value={stats.total} />
                        <SummaryTile label="Compliant" value={stats.compliant} accent="pass" />
                        <SummaryTile label="Warnings" value={stats.warnings} accent="warn" />
                        <SummaryTile label="Violations" value={stats.violations} accent="fail" />
                    </div>
                    <div className="mt-4 rounded-sm border border-zinc-300 p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 font-mono">
                                    Evidence integrity
                                </div>
                                <div className={`text-lg font-semibold font-display ${integrityOk ? "text-emerald-700" : "text-red-700"}`}>
                                    {integrityOk ? "All decisions verified" : "Integrity failure detected"}
                                </div>
                                {tampered && (
                                    <div className="text-[11px] text-amber-700 font-mono mt-0.5">
                                        Session flagged as tampered during audit.
                                    </div>
                                )}
                            </div>
                            <PassFailBadge pass={!!integrityOk} testid="report-integrity-badge" />
                        </div>
                    </div>
                </section>

                {/* Scope */}
                <section className="mb-8">
                    <SectionTitle>2 · Scope &amp; policy set</SectionTitle>
                    <div className="text-sm text-zinc-700 mt-2">
                        This session evaluated {stats.total} AI decisions against the following registered policy versions:
                    </div>
                    <ul className="mt-2 font-mono text-[12px] text-zinc-800 list-disc list-inside">
                        {(session?.registered_policy_versions || []).map((p) => (
                            <li key={p}>{p}</li>
                        ))}
                    </ul>
                </section>

                {/* Decisions table */}
                <section className="mb-8">
                    <SectionTitle>3 · Decision ledger</SectionTitle>
                    <table className="w-full text-[11px] mt-3 border border-zinc-300">
                        <thead>
                            <tr className="bg-zinc-50 text-[10px] uppercase tracking-[0.15em] text-zinc-600 font-mono">
                                <th className="text-left py-2 px-2 border-b border-zinc-300 font-normal">ID</th>
                                <th className="text-left py-2 px-2 border-b border-zinc-300 font-normal">Timestamp</th>
                                <th className="text-left py-2 px-2 border-b border-zinc-300 font-normal">Action</th>
                                <th className="text-left py-2 px-2 border-b border-zinc-300 font-normal">Policy</th>
                                <th className="text-left py-2 px-2 border-b border-zinc-300 font-normal">Status</th>
                                <th className="text-left py-2 px-2 border-b border-zinc-300 font-normal">Canonical hash</th>
                            </tr>
                        </thead>
                        <tbody>
                            {decisions.map((d) => (
                                <tr key={d.id} className="border-b border-zinc-200">
                                    <td className="py-2 px-2 font-mono">{d.id}</td>
                                    <td className="py-2 px-2 font-mono">{d.timestamp}</td>
                                    <td className="py-2 px-2">{d.action.replace(/_/g, " ")}</td>
                                    <td className="py-2 px-2 font-mono">{d.policy_version}</td>
                                    <td className="py-2 px-2"><StatusBadge status={d.policy_status} /></td>
                                    <td className="py-2 px-2 font-mono">{d.evidence.canonical_hash.slice(0, 16)}…</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>

                {/* Verification */}
                <section className="mb-8">
                    <SectionTitle>4 · Evidence verification</SectionTitle>
                    <table className="w-full text-[11px] mt-3 border border-zinc-300">
                        <thead>
                            <tr className="bg-zinc-50 text-[10px] uppercase tracking-[0.15em] text-zinc-600 font-mono">
                                <th className="text-left py-2 px-2 border-b border-zinc-300 font-normal">Decision</th>
                                <th className="text-left py-2 px-2 border-b border-zinc-300 font-normal">Canonical</th>
                                <th className="text-left py-2 px-2 border-b border-zinc-300 font-normal">SHA-256</th>
                                <th className="text-left py-2 px-2 border-b border-zinc-300 font-normal">Chain</th>
                                <th className="text-left py-2 px-2 border-b border-zinc-300 font-normal">Policy ver.</th>
                                <th className="text-left py-2 px-2 border-b border-zinc-300 font-normal">Overall</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(verification?.results || []).map((r) => (
                                <tr key={r.id} className="border-b border-zinc-200">
                                    <td className="py-2 px-2 font-mono">{r.id}</td>
                                    <td className="py-2 px-2"><PassFailBadge pass={r.checks.canonical_representation.pass} /></td>
                                    <td className="py-2 px-2"><PassFailBadge pass={r.checks.sha256_integrity.pass} /></td>
                                    <td className="py-2 px-2"><PassFailBadge pass={r.checks.hash_chain_continuity.pass} /></td>
                                    <td className="py-2 px-2"><PassFailBadge pass={r.checks.policy_version.pass} /></td>
                                    <td className="py-2 px-2"><PassFailBadge pass={r.pass} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>

                {/* Attestation */}
                <section className="mb-4">
                    <SectionTitle>5 · Auditor attestation</SectionTitle>
                    <p className="text-[12px] text-zinc-700 mt-2 leading-relaxed">
                        The auditor re-derived canonical representations of every decision using deterministic
                        RFC-8785-flavoured JSON canonicalization, recomputed SHA-256 digests, and verified
                        hash-chain continuity across the session. Policy versions were checked against the
                        registered policy set declared at session start.
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-3 italic">
                        Aura-Guard is a compliance/audit demonstrator. It is not a certified compliance product and
                        does not constitute an EU AI Act, SOC 2, ISO 27001 or any other regulatory attestation.
                    </p>
                    <div className="grid grid-cols-2 gap-6 mt-6">
                        <div className="border-t border-zinc-400 pt-1 text-[11px] font-mono text-zinc-700">
                            Auditor signature
                        </div>
                        <div className="border-t border-zinc-400 pt-1 text-[11px] font-mono text-zinc-700">
                            Date
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}

function SectionTitle({ children }) {
    return (
        <h2 className="font-display text-sm uppercase tracking-[0.22em] text-zinc-700 border-b border-zinc-300 pb-1">
            {children}
        </h2>
    );
}

function MetaField({ label, value }) {
    return (
        <div>
            <div className="text-[9px] uppercase tracking-[0.2em] text-zinc-500">{label}</div>
            <div className="text-zinc-800 mt-0.5 truncate">{value || "—"}</div>
        </div>
    );
}

function SummaryTile({ label, value, accent }) {
    const cls = {
        pass: "text-emerald-700",
        warn: "text-amber-700",
        fail: "text-red-700",
    }[accent] || "text-zinc-900";
    return (
        <div className="rounded-sm border border-zinc-300 p-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-mono">{label}</div>
            <div className={`mt-1 font-display text-2xl font-semibold tabular-nums ${cls}`}>{value}</div>
        </div>
    );
}
