"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api, saveTokens } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { AmbientBackdrop } from "@/components/AmbientBackdrop";

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
      setError(err instanceof Error ? err.message : "Sign in failed — check email and password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <AmbientBackdrop variant="auth" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col justify-between px-6 py-10 lg:px-10">
        <header className="max-w-2xl">
          <p className="font-data text-sm text-primary">CardioSense AI</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl sm:leading-[1.1]">
            Live ECG for home and clinic
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
            Watch the strip, read beat labels, and get decision-support alerts. Research demo — not a medical
            device.
          </p>
        </header>

        <section
          className="glass-strong mt-10 w-full max-w-md self-end rounded-sm p-6 phosphor-frame sm:mt-0"
          aria-label="Sign in"
        >
          <h2 className="text-xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">Open the clinician console with your account.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                autoComplete="username"
                className="min-h-11 rounded-sm"
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
                className="min-h-11 rounded-sm"
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription className="break-all">{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="min-h-11 w-full rounded-sm" disabled={busy || guestBusy}>
              {busy && <Loader2 className="animate-spin" aria-hidden />}
              {busy ? "Signing in…" : "Continue to patients"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              No account?{" "}
              <Link href="/register" className="text-primary hover:underline">
                Register
              </Link>
            </p>
            <p className="text-center font-data text-sm text-muted-foreground">
              demo · clinician@example.com / demo1234
            </p>
          </form>

          <div className="relative my-6">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-transparent px-2 font-data text-sm text-muted-foreground backdrop-blur-sm">
              or
            </span>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Try without signing in</p>
            <p className="text-sm text-muted-foreground">
              Jump into home monitoring with replay, rhythm, risk, alerts, and Dr. Aime. Sensor pairing comes
              later.
            </p>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full rounded-sm"
              disabled={busy || guestBusy}
              onClick={() => {
                setGuestBusy(true);
                setError(null);
                router.push("/home");
              }}
            >
              {guestBusy && <Loader2 className="animate-spin" aria-hidden />}
              {guestBusy ? "Opening…" : "Continue as guest"}
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
