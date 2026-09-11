import React, { useRef } from "react";
import { useAudit } from "@/context/AuditContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload, RotateCcw, Database, ShieldCheck, ShieldAlert, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { humanize, truncHash } from "@/lib/format";

function KpiCard({ label, value, sub, tone = "default", Icon, testid }) {
    const toneClass = {
        default: "text-zinc-100",
        emerald: "text-emerald-400",
        amber: "text-amber-400",
        red: "text-red-400",
    }[tone];
    return (
        <Card
            data-testid={testid}
            className="bg-zinc-900/60 border border-zinc-800 rounded-md hover:border-zinc-600 transition-colors duration-200"
        >
            <CardContent className="p-5">
                <div className="flex items-center justify-between">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 font-mono">
                        {label}
                    </div>
                    {Icon && <Icon className={`h-4 w-4 ${toneClass}`} strokeWidth={1.75} />}
                </div>
                <div className={`mt-3 font-display text-3xl sm:text-4xl font-semibold tabular-nums ${toneClass}`}>
                    {value}
                </div>
                {sub && <div className="mt-1 text-xs text-zinc-500">{sub}</div>}
            </CardContent>
        </Card>
    );
}

function integrityTone(integrityOk) {
    if (integrityOk === null) return { card: "bg-zinc-900/60 border-zinc-800", text: "text-zinc-300", headline: "Computing…" };
    if (integrityOk)          return { card: "bg-emerald-500/[0.04] border-emerald-800/60", text: "text-emerald-400", headline: "All checks passed" };
    return { card: "bg-red-500/[0.05] border-red-800/60", text: "text-red-400", headline: "Integrity failure detected" };
}

function integrityDetail(integrityOk, tampered) {
    if (integrityOk) return "Canonical representation, SHA-256 integrity, hash-chain continuity and policy version verified across all decisions.";
    if (tampered)    return "One or more decisions were modified after evidence generation. Hash-chain no longer resolves.";
    return "One or more decisions failed cryptographic or policy verification.";
}

function statusTone(status) {
    if (status === "compliant") return "text-emerald-400";
    if (status === "warning")   return "text-amber-400";
    if (status === "violation") return "text-red-400";
    return "text-zinc-400";
}

export default function Dashboard() {
    const { session, stats, integrityOk, tampered, resetSession, importSession, decisions } = useAudit();
    const fileRef = useRef(null);
    const navigate = useNavigate();

    const onFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            await importSession(parsed);
            toast.success("Session imported", { description: `${parsed.decisions?.length ?? 0} decisions loaded.` });
        } catch (err) {
            toast.error("Import failed", { description: err.message });
        } finally {
            e.target.value = "";
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                    <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 font-mono">
                        Audit session
                    </div>
                    <h1 className="mt-1 font-display text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-zinc-50" data-testid="session-name">
                        {session?.session_name || "—"}
                    </h1>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
                        <span><span className="text-zinc-500">Session:</span> <span className="font-mono text-zinc-300">{session?.session_id}</span></span>
                        <span><span className="text-zinc-500">Organization:</span> <span className="text-zinc-300">{session?.organization}</span></span>
                        <span><span className="text-zinc-500">Auditor:</span> <span className="text-zinc-300">{session?.auditor}</span></span>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <input
                        ref={fileRef}
                        type="file"
                        accept="application/json,.json"
                        onChange={onFile}
                        className="hidden"
                        data-testid="import-json-input"
                    />
                    <Button
                        variant="outline"
                        className="rounded-sm border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-100"
                        onClick={() => fileRef.current?.click()}
                        data-testid="import-json-btn"
                    >
                        <Upload className="h-4 w-4 mr-2" strokeWidth={1.75} /> Import JSON log
                    </Button>
                    <Button
                        variant="outline"
                        className="rounded-sm border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-100"
                        onClick={() => { resetSession(); toast.success("Sample session reloaded"); }}
                        data-testid="reset-sample-btn"
                    >
                        <RotateCcw className="h-4 w-4 mr-2" strokeWidth={1.75} /> Load sample
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="kpi-grid">
                <KpiCard
                    label="Total decisions"
                    value={stats.total}
                    Icon={Database}
                    sub="In current session"
                    testid="kpi-total"
                />
                <KpiCard
                    label="Compliant"
                    value={stats.compliant}
                    tone="emerald"
                    Icon={CheckCircle2}
                    sub={`${stats.total ? Math.round((stats.compliant / stats.total) * 100) : 0}% of decisions`}
                    testid="kpi-compliant"
                />
                <KpiCard
                    label="Warnings"
                    value={stats.warnings}
                    tone="amber"
                    Icon={AlertTriangle}
                    sub="Advisory review"
                    testid="kpi-warnings"
                />
                <KpiCard
                    label="Violations"
                    value={stats.violations}
                    tone="red"
                    Icon={XCircle}
                    sub="Policy breaches"
                    testid="kpi-violations"
                />
            </div>

            <Card className={`rounded-md border ${integrityTone(integrityOk).card}`} data-testid="integrity-card">
                <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center gap-6">
                    <div className="flex items-center gap-4">
                        {integrityOk ? (
                            <ShieldCheck className="h-10 w-10 text-emerald-400" strokeWidth={1.5} />
                        ) : (
                            <ShieldAlert className="h-10 w-10 text-red-400" strokeWidth={1.5} />
                        )}
                        <div>
                            <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 font-mono">
                                Evidence integrity
                            </div>
                            <div className={`font-display text-2xl font-semibold ${integrityTone(integrityOk).text}`}>
                                {integrityTone(integrityOk).headline}
                            </div>
                            <div className="text-xs text-zinc-400 mt-1 max-w-xl">
                                {integrityDetail(integrityOk, tampered)}
                            </div>
                        </div>
                    </div>
                    <div className="sm:ml-auto flex flex-wrap gap-2">
                        <Button
                            variant="outline"
                            className="rounded-sm border-zinc-700 bg-zinc-900 hover:bg-zinc-800"
                            onClick={() => navigate("/verification")}
                            data-testid="goto-verification-btn"
                        >
                            View verification
                        </Button>
                        <Button
                            variant="outline"
                            className="rounded-sm border-zinc-700 bg-zinc-900 hover:bg-zinc-800"
                            onClick={() => navigate("/report")}
                            data-testid="goto-report-btn"
                        >
                            Open report
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-zinc-900/60 border border-zinc-800 rounded-md">
                <CardContent className="p-6">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 font-mono mb-3">
                        Session ledger · latest entries
                    </div>
                    <div className="divide-y divide-zinc-800" data-testid="latest-decisions">
                        {decisions.slice(-5).reverse().map((d) => (
                            <div key={d.id} className="py-3 flex items-center gap-4 text-sm">
                                <span className="font-mono text-zinc-400 w-24 shrink-0">{d.id}</span>
                                <span className="text-zinc-300 truncate flex-1">{humanize(d.action)}</span>
                                <span className="hidden sm:inline text-zinc-500 font-mono text-xs w-40 truncate">
                                    {truncHash(d.evidence?.canonical_hash)}
                                </span>
                                <span className={`font-mono text-[11px] uppercase tracking-wider ${statusTone(d.policy_status)}`}>
                                    {d.policy_status || "—"}
                                </span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
