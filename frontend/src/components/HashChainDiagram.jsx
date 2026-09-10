import React from "react";
import { truncHash } from "@/lib/format";
import { ArrowRight, Link2, Link2Off } from "lucide-react";

/**
 * Read-only visual hash chain: prev_hash → chain_hash → next.
 * A block turns red when that decision's verification fails; the connecting
 * arrow to the NEXT block also turns red if the two hashes don't link
 * (i.e. next.prev_hash !== current.chain_hash).
 *
 * This is UI only. It does not change any hash computation.
 */
export default function HashChainDiagram({ decisions, verification }) {
    if (!decisions?.length) return null;
    const resultsById = new Map(
        (verification?.results || []).map((r) => [r.id, r])
    );

    return (
        <div
            className="rounded-md border border-zinc-800 bg-zinc-950/50 p-4 overflow-x-auto"
            data-testid="hash-chain-diagram"
            aria-label="Hash chain visualization"
        >
            <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 font-mono mb-3">
                Hash chain · prev_hash → chain_hash
            </div>
            <div className="flex items-stretch gap-2 min-w-max">
                {decisions.map((d, i) => {
                    const res = resultsById.get(d.id);
                    const blockOk = res?.pass ?? true;
                    const next = decisions[i + 1];
                    const linkOk = !next
                        ? true
                        : next.evidence?.prev_hash === d.evidence?.chain_hash;

                    return (
                        <React.Fragment key={d.id}>
                            <div
                                data-testid={`chain-block-${d.id}`}
                                className={`w-40 shrink-0 rounded-sm border p-3 ${
                                    blockOk
                                        ? "border-emerald-800/60 bg-emerald-500/[0.06]"
                                        : "border-red-800/60 bg-red-500/[0.08]"
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="font-mono text-[10px] text-zinc-400">{d.id}</span>
                                    <span className={`font-mono text-[9px] uppercase tracking-wider ${
                                        blockOk ? "text-emerald-400" : "text-red-400"
                                    }`}>
                                        {blockOk ? "PASS" : "FAIL"}
                                    </span>
                                </div>
                                <div className="mt-2 space-y-1 font-mono text-[9px] leading-relaxed">
                                    <div>
                                        <div className="text-zinc-500 uppercase tracking-wider">prev</div>
                                        <div className="text-zinc-300 truncate" title={d.evidence?.prev_hash}>
                                            {truncHash(d.evidence?.prev_hash, 14)}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-zinc-500 uppercase tracking-wider">chain</div>
                                        <div className="text-zinc-300 truncate" title={d.evidence?.chain_hash}>
                                            {truncHash(d.evidence?.chain_hash, 14)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {next && (
                                <div
                                    data-testid={`chain-link-${d.id}`}
                                    className={`flex flex-col items-center justify-center px-1 ${
                                        linkOk ? "text-emerald-500" : "text-red-500"
                                    }`}
                                    title={linkOk ? "prev_hash matches previous chain_hash" : "hash-chain broken"}
                                >
                                    {linkOk ? (
                                        <Link2 className="h-3.5 w-3.5" strokeWidth={2} />
                                    ) : (
                                        <Link2Off className="h-3.5 w-3.5" strokeWidth={2} />
                                    )}
                                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
}
