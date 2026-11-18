"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api, saveTokens } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AmbientBackdrop } from "@/components/AmbientBackdrop";

const ROLES = [
  { value: "clinician", label: "Clinician" },
  { value: "technician", label: "Technician" },
  { value: "org_admin", label: "Org admin" },
  { value: "patient", label: "Patient" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("clinician");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.register({
        email,
        password,
        full_name: fullName,
        role,
      });
      const tokens = await api.login(email, password);
      saveTokens(tokens);
      router.push("/patients");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account — try a different email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <AmbientBackdrop variant="auth" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12">
        <p className="font-data text-sm text-primary">CardioSense AI</p>
        <section className="glass-strong mt-4 rounded-sm p-6 phosphor-frame">
          <h1 className="text-2xl font-semibold tracking-tight">Create account</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Save patients and sessions. Or use guest mode from the sign-in page — no account needed.
          </p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                className="min-h-11 rounded-sm"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                className="min-h-11 rounded-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password (min 8)</Label>
              <Input
                id="password"
                type="password"
                className="min-h-11 rounded-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="min-h-11 rounded-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription className="break-all">{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="min-h-11 w-full rounded-sm" disabled={busy}>
              {busy && <Loader2 className="animate-spin" aria-hidden />}
              {busy ? "Creating…" : "Create account"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}
