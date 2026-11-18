"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2, Play, Radio, Square } from "lucide-react";
import { BeatRibbon } from "@/components/BeatRibbon";
import { BeatMark, EcgCanvas } from "@/components/EcgCanvas";
import { api } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { riskBarClass, riskLabel, riskVariant } from "@/lib/risk";

type Counts = Record<string, number>;

type RhythmWindow = {
  t0: number;
  t1: number;
  hr_bpm: number | null;
  sqi: number;
  findings: string[];
  s_burden_pct: number;
  v_burden_pct: number;
  n_beats: number;
};

type RiskState = {
  score: number;
  band: string;
  tier: string;
  factors: string[];
};

type LiveAlert = {
  rule_id: string;
  tier: string;
  title: string;
  message: string;
  t: number;
};

type InsightTab = "rhythm" | "risk" | "alerts" | "beats";

type Props = {
  patientId: number;
  title: string;
  subtitle?: string;
  riskBand?: string;
  initialRecord?: string;
  recordPath?: (record: string) => string;
  backHref?: string;
  backLabel?: string;
  onModelVersion?: (version: string | null) => void;
  showGroundTruthDefault?: boolean;
};

export function LiveEcgWorkspace({
  patientId,
  title,
  subtitle,
  riskBand,
  initialRecord = "100",
  recordPath,
  backHref,
  backLabel = "Back",
  onModelVersion,
  showGroundTruthDefault = true,
}: Props) {
  const router = useRouter();
  const [record, setRecord] = useState(initialRecord);
  const [status, setStatus] = useState("Idle — press Start replay");
  const [error, setError] = useState<string | null>(null);
  const [fs, setFs] = useState(250);
  const [samples, setSamples] = useState<number[]>([]);
  const [beats, setBeats] = useState<BeatMark[]>([]);
  const [gtBeats, setGtBeats] = useState<BeatMark[]>([]);
  const [showGt, setShowGt] = useState(showGroundTruthDefault);
  const [speed, setSpeed] = useState("1");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const [rhythm, setRhythm] = useState<RhythmWindow | null>(null);
  const [risk, setRisk] = useState<RiskState | null>(null);
  const [alerts, setAlerts] = useState<LiveAlert[]>([]);
  const [tab, setTab] = useState<InsightTab>("rhythm");
  const wsRef = useRef<WebSocket | null>(null);
  const sampleBuf = useRef<number[]>([]);

  useEffect(() => {
    setRecord(initialRecord);
  }, [initialRecord]);

  const stopWs = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setLive(false);
  }, []);

  useEffect(() => () => stopWs(), [stopWs]);

  // Prefer Alerts tab when a new alert arrives
  useEffect(() => {
    if (alerts.length > 0) setTab((t) => (t === "rhythm" || t === "risk" ? "alerts" : t));
  }, [alerts.length]);

  const counts = useMemo(() => {
    const c: Counts = { N: 0, S: 0, V: 0, F: 0, Unknown: 0 };
    for (const b of beats) c[b.label] = (c[b.label] ?? 0) + 1;
    return c;
  }, [beats]);

  const gtCounts = useMemo(() => {
    const c: Counts = { N: 0, S: 0, V: 0, F: 0 };
    for (const b of gtBeats) c[b.label] = (c[b.label] ?? 0) + 1;
    return c;
  }, [gtBeats]);

  async function startReplay() {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setError("Session missing — return to login and try again.");
      return;
    }
    setBusy(true);
    setLive(false);
    setError(null);
    setStatus("Preparing replay…");
    stopWs();
    sampleBuf.current = [];
    setSamples([]);
    setBeats([]);
    setGtBeats([]);
    setRhythm(null);
    setRisk(null);
    setAlerts([]);
    setTab("rhythm");

    try {
      const replay = await api.startReplay(patientId, record, Number(speed));
      setFs(replay.fs);
      setStatus(`Streaming ${replay.record} · ${replay.duration_s.toFixed(0)}s @ ${speed}×`);
      setLive(true);

      const ws = new WebSocket(api.wsUrl(replay.ws_path, token));
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data as string);
        if (msg.type === "meta") {
          onModelVersion?.((msg.model_version as string) ?? null);
          setFs(msg.fs);
        } else if (msg.type === "frame") {
          sampleBuf.current.push(...(msg.samples as number[]));
          const keep = Math.floor((msg.fs as number) * 20);
          if (sampleBuf.current.length > keep) {
            sampleBuf.current = sampleBuf.current.slice(-keep);
          }
          setSamples([...sampleBuf.current]);
        } else if (msg.type === "beat") {
          const b = msg.beat as { time_s: number; label: string; confidence: number };
          setBeats((prev) => [...prev, { time_s: b.time_s, label: b.label, confidence: b.confidence }]);
        } else if (msg.type === "gt") {
          const b = msg.beat as { time_s: number; label: string };
          setGtBeats((prev) => [...prev, { time_s: b.time_s, label: b.label }]);
        } else if (msg.type === "rhythm") {
          setRhythm(msg.window as RhythmWindow);
        } else if (msg.type === "risk") {
          setRisk(msg.risk as RiskState);
        } else if (msg.type === "alert") {
          const a = msg.alert as LiveAlert;
          setAlerts((prev) => [a, ...prev].slice(0, 20));
        } else if (msg.type === "done") {
          setStatus("Replay finished");
          setBusy(false);
          setLive(false);
        } else if (msg.type === "error") {
          setError(msg.detail);
          setBusy(false);
          setLive(false);
        }
      };
      ws.onerror = () => {
        setError("Connection lost — is the API running on :8000?");
        setBusy(false);
        setLive(false);
      };
      ws.onclose = () => setLive(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Replay failed");
      setStatus("Idle");
      setBusy(false);
      setLive(false);
    }
  }

  const tabs: { id: InsightTab; label: string; hint?: string }[] = [
    { id: "rhythm", label: "Rhythm" },
    { id: "risk", label: "Risk" },
    { id: "alerts", label: "Alerts", hint: alerts.length ? String(alerts.length) : undefined },
    { id: "beats", label: "Beats" },
  ];

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          {backHref && (
            <Button variant="ghost" size="sm" asChild className="-ml-2 min-h-11 text-muted-foreground">
              <Link href={backHref}>
                <ArrowLeft className="h-4 w-4" />
                {backLabel}
              </Link>
            </Button>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
            {riskBand && <Badge variant={riskVariant(riskBand)}>{riskLabel(riskBand)}</Badge>}
            <Badge variant="demo" className="gap-1">
              <Radio className="h-3 w-3" aria-hidden />
              Demo replay
            </Badge>
            {live && (
              <Badge variant="success" className="gap-1.5">
                <span className="h-1.5 w-1.5 animate-pulse-live rounded-full bg-primary" aria-hidden />
                Live
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{subtitle ?? `MIT-BIH ${record}`}</p>
        </div>
      </header>

      <div
        className="glass flex flex-wrap items-end gap-3 rounded-sm px-3 py-3"
        role="toolbar"
        aria-label="Replay controls"
      >
        <div className="space-y-1.5">
          <Label className="text-sm text-muted-foreground">Record</Label>
          <Select
            value={record}
            disabled={busy}
            onValueChange={(v) => {
              setRecord(v);
              if (recordPath) router.replace(recordPath(v));
            }}
          >
            <SelectTrigger className="min-h-11 w-[110px] rounded-sm font-data">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["100", "119", "208", "200", "233"].map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm text-muted-foreground">Speed</Label>
          <Select value={speed} onValueChange={setSpeed} disabled={busy}>
            <SelectTrigger className="min-h-11 w-[100px] rounded-sm font-data">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["0.5", "1", "2", "4"].map((s) => (
                <SelectItem key={s} value={s}>
                  {s}×
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-h-11 items-center gap-2 pb-0.5">
          <Checkbox id="gt" checked={showGt} onCheckedChange={(v) => setShowGt(Boolean(v))} className="h-5 w-5" />
          <Label htmlFor="gt" className="text-sm font-normal">
            Ground truth
          </Label>
        </div>
        <Button onClick={startReplay} disabled={busy} className="min-h-11 min-w-[140px] rounded-sm">
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
          {busy ? "Running…" : "Start replay"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 min-w-[100px] rounded-sm"
          disabled={!live && !busy}
          onClick={() => {
            stopWs();
            setBusy(false);
            setStatus("Stopped");
          }}
        >
          <Square className="h-3.5 w-3.5" aria-hidden />
          Stop
        </Button>
        <p className="ml-auto self-center font-data text-sm text-muted-foreground" aria-live="polite">
          {status}
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Instrument layout: waveform primary, insights as rail/tabs */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,22rem)] lg:items-start">
        <section
          className="overflow-hidden rounded-sm border border-border bg-white phosphor-frame"
          aria-label="ECG strip"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h2 className="text-base font-semibold">ECG strip</h2>
              <p className="text-sm text-muted-foreground">Waveform with beat markers</p>
            </div>
          </div>
          <div className="relative p-3 sm:p-4">
            <div className="pointer-events-none absolute inset-3 z-10 scanline opacity-20 sm:inset-4" aria-hidden />
            <EcgCanvas samples={samples} fs={fs} beats={beats} />
            <div className="mt-4 space-y-2">
              <p className="text-sm text-muted-foreground">Beat ribbon · last ~72</p>
              <BeatRibbon beats={beats} />
              <ul className="flex flex-wrap gap-3 text-sm text-muted-foreground" aria-label="Beat label legend">
                {(
                  [
                    ["N", "Normal", "bg-primary"],
                    ["S", "Supraventricular", "bg-[hsl(var(--warning))]"],
                    ["V", "Ventricular", "bg-destructive"],
                    ["F", "Fusion", "bg-[hsl(var(--fusion))]"],
                  ] as const
                ).map(([code, name, swatch]) => (
                  <li key={code} className="inline-flex items-center gap-1.5">
                    <span className={cn("grid h-5 w-5 place-items-center rounded-sm text-[11px] font-bold text-primary-foreground", swatch)}>
                      {code}
                    </span>
                    <span>
                      <span className="font-medium text-foreground">{code}</span> {name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <aside className="glass overflow-hidden rounded-sm" aria-label="Live insights">
          <div
            className="flex gap-1 overflow-x-auto border-b border-white/5 p-1.5"
            role="tablist"
            aria-label="Insight panels"
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "inline-flex min-h-11 min-w-[4.5rem] flex-1 items-center justify-center gap-1.5 rounded-sm px-3 text-sm transition",
                  tab === t.id
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                {t.label}
                {t.hint && (
                  <span className="rounded-full bg-destructive/20 px-1.5 text-xs text-destructive">{t.hint}</span>
                )}
              </button>
            ))}
          </div>

          <div className="max-h-[min(52vh,28rem)] overflow-y-auto p-4" role="tabpanel">
            {tab === "rhythm" && (
              <div className="space-y-4 text-sm">
                {rhythm ? (
                  <>
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-muted-foreground">Heart rate</p>
                        <p className="font-data text-3xl font-semibold tabular-nums text-primary">
                          {rhythm.hr_bpm != null ? Math.round(rhythm.hr_bpm) : "—"}
                          <span className="ml-1 text-sm font-normal text-muted-foreground">bpm</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground">Signal quality</p>
                        <p className="font-data text-lg font-semibold tabular-nums">{Math.round(rhythm.sqi * 100)}%</p>
                      </div>
                    </div>
                    <p className="text-muted-foreground">
                      S {rhythm.s_burden_pct.toFixed(1)}% · V {rhythm.v_burden_pct.toFixed(1)}% · {rhythm.n_beats}{" "}
                      beats · t={rhythm.t1.toFixed(0)}s
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(rhythm.findings.length ? rhythm.findings : ["awaiting"]).map((f) => (
                        <Badge key={f} variant="outline" className="font-normal">
                          {f.replaceAll("_", " ")}
                        </Badge>
                      ))}
                    </div>
                  </>
                ) : (
                  <EmptyInsight
                    title="Rhythm updates every 10 seconds"
                    body="Start replay to see heart rate, SQI, and rule findings here — no need to scroll the strip away."
                  />
                )}
              </div>
            )}

            {tab === "risk" && (
              <div className="space-y-4 text-sm">
                {risk ? (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <p
                        className="font-data text-3xl font-semibold tabular-nums"
                        aria-label={`Risk score ${risk.score}`}
                      >
                        {risk.score}
                      </p>
                      <Badge variant={riskVariant(risk.band)} className="rounded-sm">
                        {riskLabel(risk.band)}
                      </Badge>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
                      <div
                        className={cn("h-full rounded-full transition-[width] duration-500 motion-safe:transition-all", riskBarClass(risk.band))}
                        style={{ width: `${Math.min(100, risk.score)}%` }}
                      />
                    </div>
                    <ul className="space-y-2 text-muted-foreground">
                      {risk.factors.map((f) => (
                        <li key={f}>· {f}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <EmptyInsight
                    title="Risk appears with each window"
                    body="Score, band, and plain-language factors show here once the rules engine runs."
                  />
                )}
              </div>
            )}

            {tab === "alerts" && (
              <ul className="space-y-3 text-sm">
                {alerts.map((a, i) => (
                  <li key={`${a.rule_id}-${a.t}-${i}`} className="glass rounded-sm p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        variant={
                          a.tier === "red" || a.tier === "orange"
                            ? "danger"
                            : a.tier === "amber"
                              ? "warning"
                              : "secondary"
                        }
                      >
                        {a.tier}
                      </Badge>
                      <span className="tabular-nums text-muted-foreground">{a.t.toFixed(0)}s</span>
                    </div>
                    <p className="mt-2 font-medium">{a.title}</p>
                    <p className="text-muted-foreground">{a.message}</p>
                  </li>
                ))}
                {alerts.length === 0 && (
                  <EmptyInsight
                    title="No alerts this session"
                    body="Tiered alerts land here with rule IDs — they won’t bury the ECG strip."
                  />
                )}
              </ul>
            )}

            {tab === "beats" && (
              <div className="space-y-5 text-sm">
                <div>
                  <h3 className="mb-2 font-medium">Model counts</h3>
                  <ul className="space-y-2">
                    {Object.entries(counts).map(([k, v]) => (
                      <li key={k} className="flex justify-between gap-2">
                        <span className="text-muted-foreground">{k}</span>
                        <span className="font-semibold tabular-nums">{v}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {showGt && (
                  <div>
                    <h3 className="mb-2 font-medium">Ground truth</h3>
                    <ul className="space-y-2">
                      {["N", "S", "V", "F"].map((k) => (
                        <li key={k} className="flex justify-between gap-2">
                          <span className="text-muted-foreground">{k}</span>
                          <span className="font-semibold tabular-nums">{gtCounts[k] ?? 0}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <h3 className="mb-2 font-medium">Latest</h3>
                  <ul className="max-h-48 space-y-2 overflow-auto">
                    {beats
                      .slice(-10)
                      .reverse()
                      .map((b, i) => (
                        <li key={`${b.time_s}-${i}`} className="flex items-center justify-between gap-2">
                          <span>
                            <span className="tabular-nums text-muted-foreground">{b.time_s.toFixed(2)}s</span>
                            {" · "}
                            <Badge
                              variant={b.label === "V" ? "danger" : b.label === "S" ? "warning" : "secondary"}
                              className="align-middle"
                            >
                              {b.label}
                            </Badge>
                          </span>
                          <span className="tabular-nums text-muted-foreground">
                            {b.confidence != null ? `${Math.round(b.confidence * 100)}%` : ""}
                          </span>
                        </li>
                      ))}
                    {beats.length === 0 && (
                      <li className="text-muted-foreground">Waiting for stream…</li>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function EmptyInsight({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-sm border border-dashed border-border bg-secondary/40 px-4 py-6">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-muted-foreground">{body}</p>
    </div>
  );
}
