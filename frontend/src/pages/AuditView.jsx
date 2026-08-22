import React, { useState } from "react";
import { useAudit } from "@/context/AuditContext";
import StatusBadge from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

function DecisionDetail({ decision }) {
    if (!decision) return null;
    return (
        <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
                <Field label="Decision ID" value={decision.id} mono />
                <Field label="Timestamp" value={decision.timestamp} mono />
                <Field label="Model" value={decision.model} mono />
                <Field label="Policy version" value={decision.policy_version} mono />
                <Field label="Subject" value={decision.subject} mono />
                <Field label="Action" value={decision.action} />
            </div>
            <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 font-mono mb-1">Reason</div>
                <div className="text-zinc-200">{decision.reason}</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Block title="Input" data={decision.input} />
                <Block title="Output" data={decision.output} />
            </div>
            <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 font-mono mb-1">Evidence</div>
                <div className="rounded-sm border border-zinc-800 bg-zinc-950 p-3 font-mono text-[11px] leading-relaxed text-zinc-300 space-y-1">
                    <div><span className="text-zinc-500">canonical_hash:</span> <span className="break-all">{decision.evidence.canonical_hash}</span></div>
                    <div><span className="text-zinc-500">prev_hash:&nbsp;&nbsp;&nbsp;&nbsp;</span> <span className="break-all">{decision.evidence.prev_hash}</span></div>
                    <div><span className="text-zinc-500">chain_hash:&nbsp;&nbsp;&nbsp;</span> <span className="break-all">{decision.evidence.chain_hash}</span></div>
                </div>
            </div>
        </div>
    );
}

function Field({ label, value, mono }) {
    return (
        <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 font-mono">{label}</div>
            <div className={mono ? "font-mono text-zinc-200 text-xs mt-1 break-all" : "text-zinc-200 mt-1"}>{value}</div>
        </div>
    );
}

function Block({ title, data }) {
    return (
        <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 font-mono mb-1">{title}</div>
            <pre className="rounded-sm border border-zinc-800 bg-zinc-950 p-3 text-[11px] leading-relaxed text-zinc-300 overflow-x-auto">
{JSON.stringify(data, null, 2)}
            </pre>
        </div>
    );
}

export default function AuditView() {
    const { decisions } = useAudit();
    const [selected, setSelected] = useState(null);

    return (
        <div className="space-y-6">
            <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 font-mono">Audit ledger</div>
                <h1 className="mt-1 font-display text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-50">
                    AI decisions
                </h1>
                <p className="text-sm text-zinc-400 mt-2 max-w-2xl">
                    Every AI decision in this session with its policy status, reason, timestamp, policy version and evidence hash. Click a row for full evidence.
                </p>
            </div>

            {/* Desktop table */}
            <Card className="hidden md:block bg-zinc-900/40 border border-zinc-800 rounded-md overflow-hidden">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm" data-testid="audit-table">
                            <thead>
                                <tr className="bg-zinc-950/50 text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-mono">
                                    <th className="text-left py-3 px-4 font-normal">ID</th>
                                    <th className="text-left py-3 px-4 font-normal">Timestamp</th>
                                    <th className="text-left py-3 px-4 font-normal">Action</th>
                                    <th className="text-left py-3 px-4 font-normal">Policy</th>
                                    <th className="text-left py-3 px-4 font-normal">Status</th>
                                    <th className="text-left py-3 px-4 font-normal">Canonical hash</th>
                                    <th className="text-right py-3 px-4 font-normal">Evidence</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/70">
                                {decisions.map((d) => (
                                    <tr key={d.id} className="hover:bg-zinc-900/60 transition-colors duration-200" data-testid={`audit-row-${d.id}`}>
                                        <td className="py-3 px-4 font-mono text-xs text-zinc-300">{d.id}</td>
                                        <td className="py-3 px-4 font-mono text-xs text-zinc-400">{d.timestamp}</td>
                                        <td className="py-3 px-4 text-zinc-200">{d.action.replace(/_/g, " ")}</td>
                                        <td className="py-3 px-4 font-mono text-xs text-zinc-400">{d.policy_version}</td>
                                        <td className="py-3 px-4"><StatusBadge status={d.policy_status} /></td>
                                        <td className="py-3 px-4 font-mono text-xs text-zinc-500">
                                            {d.evidence.canonical_hash.slice(0, 16)}…
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-7 rounded-sm border-zinc-700 bg-zinc-900 hover:bg-zinc-800"
                                                onClick={() => setSelected(d)}
                                                data-testid={`view-decision-${d.id}`}
                                            >
                                                <Eye className="h-3.5 w-3.5 mr-1" strokeWidth={1.75} /> View
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3" data-testid="audit-cards">
                {decisions.map((d) => (
                    <Card key={d.id} className="bg-zinc-900/60 border border-zinc-800 rounded-md">
                        <CardContent className="p-4 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="font-mono text-xs text-zinc-300">{d.id}</span>
                                <StatusBadge status={d.policy_status} />
                            </div>
                            <div className="text-sm text-zinc-200">{d.action.replace(/_/g, " ")}</div>
                            <div className="text-xs text-zinc-500 font-mono">{d.timestamp}</div>
                            <div className="text-xs text-zinc-500 font-mono truncate">
                                {d.evidence.canonical_hash.slice(0, 24)}…
                            </div>
                            <Button
                                size="sm"
                                variant="outline"
                                className="w-full rounded-sm border-zinc-700 bg-zinc-900 hover:bg-zinc-800 mt-2"
                                onClick={() => setSelected(d)}
                                data-testid={`view-decision-mobile-${d.id}`}
                            >
                                View evidence
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
                <DialogContent
                    className="max-w-3xl bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100"
                    data-testid="decision-detail-dialog"
                >
                    <DialogHeader>
                        <DialogTitle className="font-display text-xl">Decision evidence</DialogTitle>
                        <DialogDescription className="text-zinc-400 text-xs">
                            Full record and cryptographic evidence for this AI decision.
                        </DialogDescription>
                    </DialogHeader>
                    <DecisionDetail decision={selected} />
                </DialogContent>
            </Dialog>
        </div>
    );
}
