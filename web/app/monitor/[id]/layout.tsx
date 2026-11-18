import { Suspense } from "react";

export default function MonitorLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<main className="p-8 text-[var(--muted)]">Loading console…</main>}>{children}</Suspense>;
}
