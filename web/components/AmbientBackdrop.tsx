import { cn } from "@/lib/utils";

const ECG_PATH =
  "M0 80 H180 L200 80 L220 20 L240 140 L260 80 H420 L440 80 L455 50 L470 110 L485 80 H700 L720 80 L735 35 L750 125 L765 80 H980 L1000 80 L1015 55 L1030 105 L1045 80 H1200";

type Props = {
  /** auth = full hero motion; app = shell atmosphere (still clearly visible) */
  variant?: "auth" | "app";
  className?: string;
};

/** Shared phosphor atmosphere for auth + app shell. */
export function AmbientBackdrop({ variant = "auth", className }: Props) {
  const isApp = variant === "app";

  return (
    <div
      className={cn(
        "pointer-events-none overflow-hidden",
        /* Must sit ABOVE body paint — never -z-10 or it vanishes */
        isApp ? "fixed inset-0 z-0" : "absolute inset-0 z-0",
        className,
      )}
      aria-hidden
    >
      {/* Base void tint so orbs read against body */}
      <div className="absolute inset-0 bg-[hsl(200_55%_4%/0.35)]" />

      <div className={cn("ambient-bloom", isApp && "ambient-bloom--app")}>
        <span className="ambient-bloom__orb ambient-bloom__orb--a" />
        <span className="ambient-bloom__orb ambient-bloom__orb--b" />
        <span className="ambient-bloom__orb ambient-bloom__orb--c" />
        {isApp && <span className="ambient-bloom__orb ambient-bloom__orb--d" />}
      </div>

      <div
        className={cn(
          "absolute inset-0 instrument-grid instrument-grid--drift",
          isApp ? "opacity-70" : "opacity-55",
        )}
      />

      {/* Soft vignette rim */}
      <div className="ambient-vignette" />

      {/* Phosphor grain */}
      <div className="ambient-grain" />

      <div
        className={cn(
          "absolute inset-x-0 scanline",
          isApp ? "inset-0 opacity-30" : "top-[16%] h-44 opacity-35",
        )}
      />
      <div className={cn("scanline-sweep", isApp && "scanline-sweep--app")} />
      {isApp && <div className="scanline-sweep scanline-sweep--app scanline-sweep--late" />}

      {/* Floating vitals ticks */}
      {isApp && (
        <div className="ambient-ticks">
          <span />
          <span />
          <span />
          <span />
        </div>
      )}

      {/* Ghost ECG only on auth — live console owns the real strip */}
      {!isApp && (
        <svg
          className="ghost-ecg absolute inset-x-0 top-[20%] h-40 w-full"
          viewBox="0 0 1200 160"
          preserveAspectRatio="none"
        >
          <path className="ghost-ecg__bloom" d={ECG_PATH} fill="none" vectorEffect="non-scaling-stroke" />
          <path className="ghost-ecg__trace" d={ECG_PATH} fill="none" vectorEffect="non-scaling-stroke" />
        </svg>
      )}

      {/* Soft spotlight that orbits */}
      <div className={cn("ambient-spotlight", isApp && "ambient-spotlight--app")} />
    </div>
  );
}

export function AmbientAuthBackdrop() {
  return <AmbientBackdrop variant="auth" />;
}
