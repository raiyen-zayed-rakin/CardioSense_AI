"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, HeartPulse, Radio, Users } from "lucide-react";
import { api, clearTokens, Patient, User } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { CreatePatientDialog } from "@/components/CreatePatientDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { riskLabel, riskVariant } from "@/lib/risk";

const RECORD_FOR_MRN: Record<string, string> = {
  "DEMO-100": "100",
  "DEMO-119": "119",
  "DEMO-208": "208",
};

export default function PatientsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [health, setHealth] = useState("checking model…");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    (async () => {
      try {
        const [me, list, h] = await Promise.all([api.me(), api.patients(), api.health()]);
        setUser(me);
        setPatients(list);
        setHealth(h.model_ready ? `Model ready · ${h.model_version ?? "loaded"}` : "Model not loaded");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      }
    })();
  }, [router]);

  function logout() {
    clearTokens();
    router.replace("/login");
  }

  return (
    <AppShell userName={user?.full_name} modelStatus={health} onLogout={logout}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Patients</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Risk-sorted queue. Open a console for live labels, rhythm, and alerts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="demo" className="gap-1.5">
            <Radio className="h-3 w-3" aria-hidden />
            Replay capable
          </Badge>
          <CreatePatientDialog onCreated={(p) => setPatients((prev) => [p, ...prev])} />
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="glass divide-y divide-white/5 overflow-hidden rounded-sm">
        {patients.map((p) => {
          const record = RECORD_FOR_MRN[p.mrn] ?? "100";
          return (
            <article
              key={p.id}
              className="flex flex-col gap-4 bg-transparent p-4 transition-colors hover:bg-white/[0.04] sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                  <HeartPulse className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold tracking-tight">{p.full_name}</h2>
                    <Badge variant={riskVariant(p.risk_band)}>{riskLabel(p.risk_band)}</Badge>
                    {!p.consent && <Badge variant="danger">No consent</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    MRN {p.mrn}
                    {p.age != null ? ` · age ${p.age}` : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">{p.notes ?? "No notes"}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 sm:shrink-0">
                <Button variant="outline" className="min-h-11" asChild>
                  <Link href={`/patients/${p.id}`}>Details</Link>
                </Button>
                <Button className="min-h-11" asChild disabled={!p.consent}>
                  <Link href={`/monitor/${p.id}?record=${record}`}>
                    Open console
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
              </div>
            </article>
          );
        })}
        {patients.length === 0 && !error && (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-secondary text-muted-foreground">
              <Users className="h-6 w-6" aria-hidden />
            </span>
            <div>
              <p className="font-medium">No patients yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Add a demo patient with consent to open the live monitoring console.
              </p>
            </div>
            <CreatePatientDialog onCreated={(p) => setPatients((prev) => [p, ...prev])} />
          </div>
        )}
      </div>
    </AppShell>
  );
}
