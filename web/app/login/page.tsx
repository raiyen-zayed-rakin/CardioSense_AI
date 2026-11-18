"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Loader2 } from "lucide-react";
import { api, saveTokens } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("clinician@example.com");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [guestBusy, setGuestBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const tokens = await api.login(email, password);
      saveTokens(tokens);
      router.push("/patients");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden instrument-grid lg:flex lg:flex-col lg:justify-between p-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-destructive/5" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Activity className="h-5 w-5" />
            </span>
            <div>
              <p className="text-lg font-semibold tracking-tight">CardioSense AI</p>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Clinical workspace</p>
            </div>
          </div>
        </div>
        <div className="relative max-w-md space-y-4">
          <Badge variant="demo">Demo / replay mode</Badge>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            See every beat. Act on the ones that matter.
          </h1>
          <p className="text-muted-foreground">
            Live ECG console with patient-wise beat labels (N / S / V / F), powered by the CardioSense
            ResNet ensemble — not a medical device.
          </p>
        </div>
        <p className="relative text-xs text-muted-foreground">MIT-BIH replay · TorchScript inference · FastAPI</p>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <Card className="w-full max-w-md border-border/70 shadow-xl shadow-black/20">
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-2 lg:hidden">
              <Activity className="h-5 w-5 text-primary" />
              <span className="font-semibold">CardioSense AI</span>
            </div>
            <CardTitle className="text-2xl">Sign in</CardTitle>
            <CardDescription>Use the seeded clinician account to open the monitoring console.</CardDescription>
          </CardHeader>
          <form onSubmit={onSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  autoComplete="username"
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  autoComplete="current-password"
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription className="break-all">{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={busy || guestBusy}>
                {busy && <Loader2 className="animate-spin" />}
                {busy ? "Signing in…" : "Continue to patients"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                No account?{" "}
                <Link href="/register" className="text-primary hover:underline">
                  Register
                </Link>
              </p>
              <p className="text-center text-xs text-muted-foreground">
                Demo · clinician@example.com / demo1234
              </p>
            </CardFooter>
          </form>

          <div className="px-6 pb-6">
            <div className="relative my-1">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                or
              </span>
            </div>
            <div className="mt-5 space-y-2 rounded-lg border border-border/70 bg-secondary/25 p-4">
              <p className="text-sm font-medium">Try without signing in</p>
              <p className="text-xs text-muted-foreground">
                Open home monitoring with live replay, rhythm, risk, alerts, and Dr. Aime. No account
                required. Sensor pairing comes later.
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={busy || guestBusy}
                onClick={() => {
                  setGuestBusy(true);
                  setError(null);
                  router.push("/home");
                }}
              >
                {guestBusy && <Loader2 className="animate-spin" />}
                {guestBusy ? "Opening…" : "Continue as guest"}
              </Button>
            </div>
          </div>
        </Card>
      </section>
    </main>
  );
}
