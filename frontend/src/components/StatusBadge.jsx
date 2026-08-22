import React from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle } from "lucide-react";

const MAP = {
    compliant: {
        label: "Compliant",
        classes: "border-emerald-700 bg-emerald-500/10 text-emerald-400",
        printClass: "print-badge-pass",
        Icon: CheckCircle2,
    },
    warning: {
        label: "Warning",
        classes: "border-amber-700 bg-amber-500/10 text-amber-400",
        printClass: "print-badge-warn",
        Icon: AlertTriangle,
    },
    violation: {
        label: "Violation",
        classes: "border-red-700 bg-red-500/10 text-red-400",
        printClass: "print-badge-fail",
        Icon: XCircle,
    },
};

export default function StatusBadge({ status, testid }) {
    const cfg = MAP[status] || {
        label: status || "Unknown",
        classes: "border-zinc-700 bg-zinc-800/40 text-zinc-300",
        printClass: "",
        Icon: HelpCircle,
    };
    const Icon = cfg.Icon;
    return (
        <Badge
            variant="outline"
            data-testid={testid}
            className={`rounded-sm font-mono text-[11px] px-2 py-0.5 gap-1.5 uppercase tracking-wider ${cfg.classes} ${cfg.printClass}`}
        >
            <Icon className="h-3 w-3" strokeWidth={2.25} />
            {cfg.label}
        </Badge>
    );
}

export function PassFailBadge({ pass, testid, labelPass = "PASS", labelFail = "FAIL" }) {
    return (
        <Badge
            variant="outline"
            data-testid={testid}
            className={`rounded-sm font-mono text-[11px] px-2 py-0.5 uppercase tracking-wider ${
                pass
                    ? "border-emerald-700 bg-emerald-500/10 text-emerald-400 print-badge-pass"
                    : "border-red-700 bg-red-500/10 text-red-400 print-badge-fail"
            }`}
        >
            {pass ? labelPass : labelFail}
        </Badge>
    );
}
