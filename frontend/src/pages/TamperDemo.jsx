import React, { useEffect, useMemo, useState } from "react";
import { useAudit } from "@/context/AuditContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { PassFailBadge } from "@/components/StatusBadge";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { humanize, DASH } from "@/lib/format";

const TAMPERABLE_FIELDS = [
    { key: "reason", label: "reason" },
    { key: "policy_version", label: "policy_version" },
    { key: "output.decision", label: "output.decision" },
    { key: "output.credit_limit", label: "output.credit_limit" },
    { key: "output.risk_score", label: "output.risk_score" },
];

function getFieldValue(decision, key) {
    if (key.includes(".")) {
        const [a, b] = key.split(".");
        return decision[a]?.[b];
    }
    return decision[key];
}

export default function TamperDemo() {
    const { decisions, verification, tamperDecision, resetSession, tampered } = useAudit();
    const [decisionId, setDecisionId] = useState(decisions[0]?.id || "");
    const [field, setField] = useState("reason");
    const [newValue, setNewValue] = useState("");

    useEffect(() => {
        if (!decisions.length) return;
        if (!decisions.find((d) => d.id === decisionId)) {
            setDecisionId(decisions[0].id);
        }
    }, [decisions, decisionId]);

    const decision = useMemo(
        () => decisions.find((d) => d.id === decisionId),
        [decisions, decisionId]
    );

    useEffect(() => {
        if (decision) setNewValue(String(getFieldValue(decision, field) ?? ""));
    }, [decisionId, field, decision]);

    const result = verification?.results.find((r) => r.id === decisionId);

    const applyTamper = () => {
        if (!decision) return;
        const original = getFieldValue(decision, field);
        let parsed = newValue;
        if (typeof original === "number") {
            const n = Number(newValue);
            if (Number.isFinite(n)) parsed = n;
        }
        tamperDecision(decisionId, field, parsed);
        toast.warning("Field modified", {
            description: `${decision.id} · ${field} changed. Verification re-run.`,
        });
    };

    return (
        <div className="space-y-8">
            <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 font-mono">
                    Tamper demonstration
                </div>
                <h1 className="mt-1 font-display text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-50">
                    Prove evidence integrity
                </h1>
                <p className="text-sm text-zinc-400 mt-2 max-w-2xl">
                    Change any field on any decision. Because canonical hashes are derived from the record itself, the auditor immediately re-derives the hash and detects the discrepancy — a downstream failure cascades through the hash chain to every subsequent record.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="bg-zinc-900/60 border border-zinc-800 rounded-md lg:col-span-1">
                    <CardContent className="p-5 space-y-4">
                        <div className="flex items-center gap-2 text-amber-400">
                            <AlertTriangle className="h-4 w-4" strokeWidth={2} />
                            <div className="text-[10px] uppercase tracking-[0.22em] font-mono">Tamper control</div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs text-zinc-400">Decision</Label>
                            <Select value={decisionId} onValueChange={setDecisionId}>
                                <SelectTrigger
                                    className="bg-zinc-950 border-zinc-800 rounded-sm text-sm font-mono"
                                    data-testid="tamper-decision-select"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
                                    {decisions.map((d) => (
                                        <SelectItem key={d.id} value={d.id} className="font-mono text-xs">
                                            {d.id} · {humanize(d.action)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs text-zinc-400">Field</Label>
                            <Select value={field} onValueChange={setField}>
                                <SelectTrigger
                                    className="bg-zinc-950 border-zinc-800 rounded-sm text-sm font-mono"
                                    data-testid="tamper-field-select"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
                                    {TAMPERABLE_FIELDS.map((f) => (
                                        <SelectItem key={f.key} value={f.key} className="font-mono text-xs">
                                            {f.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs text-zinc-400">New value</Label>
                            <Input
                                value={newValue}
                                onChange={(e) => setNewValue(e.target.value)}
                                className="bg-zinc-950 border-zinc-800 rounded-sm text-sm font-mono"
                                data-testid="tamper-value-input"
                            />
                        </div>

                        <div className="flex gap-2 pt-2">
                            <Button
                                className="rounded-sm bg-red-600 hover:bg-red-500 text-white flex-1"
                                onClick={applyTamper}
                                data-testid="apply-tamper-btn"
                            >
                                Apply tamper
                            </Button>
                            <Button
                                variant="outline"
                                className="rounded-sm border-zinc-700 bg-zinc-900 hover:bg-zinc-800"
                                onClick={() => { resetSession(); toast.success("Session reset to original evidence."); }}
                                data-testid="tamper-reset-btn"
                            >
                                <RotateCcw className="h-4 w-4" strokeWidth={1.75} />
                            </Button>
                        </div>

                        {tampered && (
                            <div className="text-[11px] text-amber-400 font-mono">
                                Session marked as tampered.
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card
                    className={`rounded-md border lg:col-span-2 ${
                        result?.pass ? "bg-emerald-500/[0.04] border-emerald-800/60" : "bg-red-500/[0.05] border-red-800/60"
                    }`}
                    data-testid="tamper-result-card"
                >
                    <CardContent className="p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 font-mono">
                                    Live verification · {decision?.id}
                                </div>
                                <div className={`font-display text-2xl font-semibold mt-1 ${result?.pass ? "text-emerald-400" : "text-red-400"}`}>
                                    {result?.pass ? "Evidence intact" : "Integrity failure"}
                                </div>
                            </div>
                            {result && <PassFailBadge pass={result.pass} testid="tamper-overall-badge" />}
                        </div>

                        {result && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" aria-live="polite">
                                {Object.entries(result.checks).map(([k, c]) => (
                                    <div
                                        key={k}
                                        className={`rounded-sm border p-3 ${c.pass ? "border-emerald-800/60 bg-emerald-500/5" : "border-red-800/60 bg-red-500/5"}`}
                                        data-testid={`tamper-check-${k}`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-400 font-mono">
                                                {c.label}
                                            </div>
                                            <PassFailBadge pass={c.pass} />
                                        </div>
                                        <div className="text-[11px] text-zinc-400 leading-relaxed">{c.detail}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {decision && (
                            <div className="pt-2">
                                <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 font-mono mb-2">
                                    Stored vs re-derived (independent recomputation)
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="rounded-sm border border-zinc-800 bg-zinc-950 p-3">
                                        <div className="text-[9px] uppercase tracking-[0.22em] text-zinc-500 font-mono mb-1">Stored canonical_hash</div>
                                        <div className="font-mono text-[10px] text-zinc-300 break-all" data-testid="stored-canonical-hash">{decision.evidence?.canonical_hash || DASH}</div>
                                    </div>
                                    <div className={`rounded-sm border p-3 ${result?.checks.sha256_integrity.pass ? "border-emerald-800/60 bg-emerald-500/[0.05]" : "border-red-800/60 bg-red-500/[0.05]"}`}>
                                        <div className="text-[9px] uppercase tracking-[0.22em] text-zinc-500 font-mono mb-1">Re-derived canonical_hash</div>
                                        <div className={`font-mono text-[10px] break-all ${result?.checks.sha256_integrity.pass ? "text-emerald-300" : "text-red-300"}`} data-testid="recomputed-canonical-hash">{result?.recomputedHash || DASH}</div>
                                    </div>
                                    <div className="rounded-sm border border-zinc-800 bg-zinc-950 p-3">
                                        <div className="text-[9px] uppercase tracking-[0.22em] text-zinc-500 font-mono mb-1">Stored chain_hash</div>
                                        <div className="font-mono text-[10px] text-zinc-300 break-all">{decision.evidence?.chain_hash || DASH}</div>
                                    </div>
                                    <div className={`rounded-sm border p-3 ${result?.checks.hash_chain_continuity.pass ? "border-emerald-800/60 bg-emerald-500/[0.05]" : "border-red-800/60 bg-red-500/[0.05]"}`}>
                                        <div className="text-[9px] uppercase tracking-[0.22em] text-zinc-500 font-mono mb-1">Re-derived chain_hash</div>
                                        <div className={`font-mono text-[10px] break-all ${result?.checks.hash_chain_continuity.pass ? "text-emerald-300" : "text-red-300"}`}>{result?.recomputedChain || DASH}</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
