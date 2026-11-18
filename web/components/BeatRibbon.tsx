"use client";

import type { BeatMark } from "./EcgCanvas";
import { cn } from "@/lib/utils";

const STYLE: Record<string, string> = {
  N: "bg-primary",
  S: "bg-[hsl(var(--warning))] border-t-2 border-dashed border-black/40",
  V: "bg-destructive border-t-2 border-double border-black/50",
  F: "bg-[hsl(var(--fusion))] border-t-2 border-dotted border-black/40",
  Unknown: "bg-muted-foreground/50",
};

export function BeatRibbon({ beats }: { beats: BeatMark[] }) {
  const recent = beats.slice(-72);
  return (
    <div
      className="flex h-10 w-full overflow-hidden rounded-md border border-border bg-secondary/60"
      role="img"
      aria-label={
        recent.length
          ? `Beat ribbon, ${recent.length} recent labels ending with ${recent[recent.length - 1]?.label}`
          : "Beat ribbon empty"
      }
    >
      {recent.length === 0 && (
        <div className="grid w-full place-items-center text-sm text-muted-foreground">No beats yet</div>
      )}
      {recent.map((b, i) => {
        const tip = `${b.label} @ ${b.time_s.toFixed(2)}s${b.confidence != null ? ` (${Math.round(b.confidence * 100)}%)` : ""}`;
        return (
          <div
            key={`${b.time_s}-${i}`}
            title={tip}
            className={cn(
              "relative min-w-0 flex-1 border-r border-black/30",
              STYLE[b.label] ?? STYLE.Unknown,
            )}
          >
            {i % 6 === 0 && (
              <span className="pointer-events-none absolute inset-0 grid place-items-center text-[10px] font-bold text-black/75">
                {b.label[0]}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
