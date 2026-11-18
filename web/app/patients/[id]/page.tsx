"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { api, clearTokens, Patient } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { riskLabel, riskVariant } from "@/lib/risk";

const RECORD_FOR_MRN: Record<string, string> = {
  "DEMO-100": "100",
  "DEMO-119": "119",
  "DEMO-208": "208",
};

export default function PatientDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!localStorage.getItem("access_token")) {
      router.replace("/login");
      return;
    }
    api
      .getPatient(id)
      .then(setPatient)
      .catch((err) => setError(err instanceof Error ? err.message : "Not found"));
  }, [id, router]);

  const record = patient ? RECORD_FOR_MRN[patient.mrn] ?? "100" : "100";

  return (
    <AppShell
      userName={patient?.full_name}
      onLogout={() => {
        clearTokens();
        router.replace("/login");
      }}
    >
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4 text-muted-foreground">
        <Link href="/patients">
          <ArrowLeft className="h-4 w-4" />
          Patients
        </Link>
      </Button>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-2xl">{patient?.full_name ?? "Patient"}</CardTitle>
              {patient && <Badge variant={riskVariant(patient.risk_band)}>{riskLabel(patient.risk_band)}</Badge>}
            </div>
            <CardDescription>Patient chart summary</CardDescription>
          </div>
          {patient?.consent && (
            <Button asChild>
              <Link href={`/monitor/${id}?record=${record}`}>
                Open console
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {[
            ["ID", patient?.id],
            ["MRN", patient?.mrn],
            ["Age", patient?.age ?? "—"],
            ["Consent", patient?.consent ? "Yes" : "No"],
            ["Risk band", patient?.risk_band],
            ["Created", patient?.created_at ? new Date(patient.created_at).toLocaleString() : "—"],
            ["Notes", patient?.notes ?? "—"],
          ].map(([label, value], i) => (
            <div key={String(label)}>
              {i > 0 && <Separator className="mb-3 opacity-40" />}
              <div className="flex justify-between gap-6">
                <span className="text-muted-foreground">{label}</span>
                <span className="max-w-[60%] text-right font-medium">{String(value ?? "…")}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </AppShell>
  );
}
