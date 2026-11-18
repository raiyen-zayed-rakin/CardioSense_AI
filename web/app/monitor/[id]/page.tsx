"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { LiveEcgWorkspace } from "@/components/LiveEcgWorkspace";
import { api, clearTokens, Patient } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function MonitorPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const patientId = Number(params.id);
  const initialRecord = search.get("record") ?? "100";

  const [patient, setPatient] = useState<Patient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modelVersion, setModelVersion] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    api
      .getPatient(patientId)
      .then(setPatient)
      .catch((err) => setError(err instanceof Error ? err.message : "Load failed"));
  }, [patientId, router]);

  return (
    <AppShell
      userName={patient?.full_name}
      modelStatus={modelVersion ?? undefined}
      onLogout={() => {
        clearTokens();
        router.replace("/login");
      }}
    >
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <LiveEcgWorkspace
        patientId={patientId}
        title={patient?.full_name ?? `Patient ${patientId}`}
        subtitle={`MIT-BIH record ${initialRecord}${modelVersion ? ` · ${modelVersion}` : ""}`}
        riskBand={patient?.risk_band}
        initialRecord={initialRecord}
        recordPath={(r) => `/monitor/${patientId}?record=${r}`}
        backHref="/patients"
        backLabel="Patients"
        onModelVersion={setModelVersion}
      />
    </AppShell>
  );
}
