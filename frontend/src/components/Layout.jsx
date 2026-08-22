import React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { ShieldCheck, LayoutDashboard, ListChecks, FileSearch, AlertTriangle, FileText } from "lucide-react";
import { useAudit } from "@/context/AuditContext";
import { Badge } from "@/components/ui/badge";

const NAV = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true, testid: "nav-dashboard" },
    { to: "/audit", label: "Audit", icon: ListChecks, testid: "nav-audit" },
    { to: "/verification", label: "Verification", icon: FileSearch, testid: "nav-verification" },
    { to: "/tamper", label: "Tamper Demo", icon: AlertTriangle, testid: "nav-tamper" },
    { to: "/report", label: "Report", icon: FileText, testid: "nav-report" },
];

export default function Layout() {
    const { integrityOk, tampered, session } = useAudit();
    const location = useLocation();
    const isReport = location.pathname === "/report";

    return (
        <div className="min-h-screen bg-[#0A0A0A] text-zinc-100 grain-overlay">
            <header className="no-print sticky top-0 z-40 bg-zinc-950/85 backdrop-blur-xl border-b border-zinc-800/70">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-sm border border-zinc-700 bg-zinc-900 flex items-center justify-center">
                            <ShieldCheck className="h-4 w-4 text-emerald-400" strokeWidth={2} />
                        </div>
                        <div className="min-w-0">
                            <div className="font-display font-semibold text-sm sm:text-base tracking-tight text-zinc-100 truncate" data-testid="app-title">
                                Aura-Guard
                            </div>
                            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 -mt-0.5">
                                Compliance Auditor · Demonstrator
                            </div>
                        </div>
                    </div>
                    <div className="hidden md:flex items-center gap-2">
                        {integrityOk === null ? null : integrityOk ? (
                            <Badge
                                data-testid="integrity-status-badge"
                                variant="outline"
                                className="border-emerald-700 bg-emerald-500/10 text-emerald-400 rounded-sm font-mono text-[11px]"
                            >
                                EVIDENCE INTEGRITY · PASS
                            </Badge>
                        ) : (
                            <Badge
                                data-testid="integrity-status-badge"
                                variant="outline"
                                className="border-red-700 bg-red-500/10 text-red-400 rounded-sm font-mono text-[11px]"
                            >
                                EVIDENCE INTEGRITY · FAIL
                            </Badge>
                        )}
                        {tampered && (
                            <Badge
                                variant="outline"
                                className="border-amber-700 bg-amber-500/10 text-amber-400 rounded-sm font-mono text-[11px]"
                                data-testid="tampered-badge"
                            >
                                TAMPERED
                            </Badge>
                        )}
                    </div>
                </div>
                <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 overflow-x-auto border-t border-zinc-900">
                    {NAV.map(({ to, label, icon: Icon, end, testid }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={end}
                            data-testid={testid}
                            className={({ isActive }) =>
                                `flex items-center gap-2 px-3 py-3 text-sm border-b-2 transition-colors duration-200 whitespace-nowrap ${
                                    isActive
                                        ? "border-emerald-500 text-zinc-50"
                                        : "border-transparent text-zinc-400 hover:text-zinc-100 hover:border-zinc-700"
                                }`
                            }
                        >
                            <Icon className="h-4 w-4" strokeWidth={1.75} />
                            {label}
                        </NavLink>
                    ))}
                </nav>
            </header>
            <main className={isReport ? "" : "relative z-10"}>
                <div className={isReport ? "" : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10"}>
                    <Outlet />
                </div>
            </main>
            <footer className="no-print border-t border-zinc-900 mt-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-[11px] text-zinc-500 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div>
                        <span className="font-mono">{session?.session_id || "—"}</span>
                        <span className="mx-2 text-zinc-700">|</span>
                        <span>Product demonstrator. Not certified compliance software. Does not constitute EU AI Act attestation.</span>
                    </div>
                    <div className="font-mono text-zinc-600">v0.1.0 · in-memory session</div>
                </div>
            </footer>
        </div>
    );
}
