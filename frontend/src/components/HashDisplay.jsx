import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { truncHash, DASH } from "@/lib/format";

/**
 * Renders a hash with a copy affordance and safe wrapping.
 * `long` shows the full value wrapped; otherwise truncated with tooltip.
 */
export default function HashDisplay({ value, long = false, testid, label }) {
    const [copied, setCopied] = useState(false);
    const val = value || "";

    const onCopy = async (e) => {
        e.stopPropagation();
        if (!val) return;
        try {
            await navigator.clipboard.writeText(val);
            setCopied(true);
            toast.success(`${label || "Hash"} copied`);
            setTimeout(() => setCopied(false), 1200);
        } catch {
            toast.error("Copy failed");
        }
    };

    return (
        <span className="inline-flex items-center gap-2 font-mono text-[11px] leading-relaxed" data-testid={testid}>
            <span
                className={long ? "text-zinc-300 break-all" : "text-zinc-300 truncate max-w-[160px]"}
                title={val || undefined}
            >
                {val ? (long ? val : truncHash(val, 16)) : DASH}
            </span>
            {val && (
                <button
                    type="button"
                    onClick={onCopy}
                    className="text-zinc-500 hover:text-zinc-200 transition-colors duration-200 rounded-sm p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                    aria-label={`Copy ${label || "hash"}`}
                    data-testid={testid ? `${testid}-copy` : undefined}
                >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </button>
            )}
        </span>
    );
}
