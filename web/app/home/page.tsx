"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { LiveEcgWorkspace } from "@/components/LiveEcgWorkspace";
import { api, clearTokens, saveGuestSession } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

function HomeContent() {
  const router = useRouter();
  const search = useSearchParams();
  const initialRecord = search.get("record") ?? "100";

  const [patientId, setPatientId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modelVersion, setModelVersion] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mode = localStorage.getItem("cs_mode");
        const token = localStorage.getItem("access_token");
        // Always use a guest session for /home so clinician tokens don't leak into home patient binding.
        if (mode !== "guest" || !token || !localStorage.getItem("guest_patient_id")) {
          const guest = await api.guest();
          if (cancelled) return;
          saveGuestSession(guest);
          setPatientId(guest.patient_id);
        } else {
          setPatientId(Number(localStorage.getItem("guest_patient_id")));
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not start guest session");
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (booting) {
    return (
      <main className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Starting home monitoring…
        </div>
      </main>
    );
  }

  if (error || patientId == null) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-6">
        <Alert variant="destructive">
          <AlertDescription>{error ?? "Guest session unavailable"}</AlertDescription>
        </Alert>
        <Button asChild>
          <Link href="/login">Back to sign in</Link>
        </Button>
      </main>
    );
  }

  return (
    <AppShell
      mode="guest"
      userName="Guest"
      modelStatus={modelVersion ?? undefined}
      onLogout={() => {
        clearTokens();
        router.replace("/login");
      }}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-secondary/25 px-4 py-3">
        <div>
          <p className="text-sm font-medium">Home monitoring · no account</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Replay demo now · AD8232 pairing later · not a medical device
          </p>
        </div>
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/register">Create account</Link>
        </Button>
      </div>

      <LiveEcgWorkspace
        patientId={patientId}
        title="My live ECG"
        subtitle={`MIT-BIH ${initialRecord}${modelVersion ? ` · ${modelVersion}` : ""}`}
        initialRecord={initialRecord}
        recordPath={(r) => `/home?record=${r}`}
        onModelVersion={setModelVersion}
      />
    </AppShell>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </main>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
