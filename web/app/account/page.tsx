"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, clearTokens, Health, User } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!localStorage.getItem("access_token")) {
      router.replace("/login");
      return;
    }
    (async () => {
      try {
        const [me, h] = await Promise.all([api.me(), api.health()]);
        setUser(me);
        setHealth(h);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load account");
      }
    })();
  }, [router]);

  return (
    <AppShell
      userName={user?.full_name}
      modelStatus={health?.model_ready ? "Model ready" : "Model offline"}
      onLogout={() => {
        clearTokens();
        router.replace("/login");
      }}
    >
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Your profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">Signed-in clinician details and model status.</p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="glass rounded-sm p-5">
          <h2 className="text-base font-semibold">Profile</h2>
          <p className="mt-1 text-sm text-muted-foreground">Who is signed in</p>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{user?.full_name ?? "…"}</span>
            </div>
            <Separator />
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Email</span>
              <span className="break-all font-medium text-right">{user?.email ?? "…"}</span>
            </div>
            <Separator />
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Role</span>
              <Badge variant="secondary">{user?.role ?? "…"}</Badge>
            </div>
          </div>
        </section>

        <section className="glass rounded-sm p-5">
          <h2 className="text-base font-semibold">System status</h2>
          <p className="mt-1 text-sm text-muted-foreground">Inference readiness</p>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">API</span>
              <Badge variant={health?.status === "ok" ? "success" : "danger"}>
                {health?.status ?? "…"}
              </Badge>
            </div>
            <Separator />
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Model ready</span>
              <span>{health?.model_ready ? "Yes" : "No"}</span>
            </div>
            <Separator />
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Version</span>
              <span className="max-w-[220px] truncate text-right text-sm">
                {health?.model_version ?? "—"}
              </span>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
