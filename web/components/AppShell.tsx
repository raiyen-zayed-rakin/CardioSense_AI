"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, Home, LogOut, Menu, UserRound, Users, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DrAimeChathead } from "@/components/DrAimeChathead";
import { AmbientBackdrop } from "@/components/AmbientBackdrop";

type Props = {
  children: React.ReactNode;
  userName?: string;
  modelStatus?: string;
  onLogout?: () => void;
  showNav?: boolean;
  showAssistant?: boolean;
  mode?: "clinician" | "guest";
};

export function AppShell({
  children,
  userName,
  modelStatus,
  onLogout,
  showNav = true,
  showAssistant = true,
  mode = "clinician",
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const isGuest = mode === "guest";
  const homeHref = isGuest ? "/home" : "/patients";
  const link = (href: string) =>
    cn(
      "inline-flex min-h-11 items-center gap-1.5 text-sm transition-colors hover:text-foreground",
      pathname.startsWith(href) ? "text-primary" : "text-muted-foreground",
    );

  function goBrand(e: React.MouseEvent) {
    e.preventDefault();
    setMenuOpen(false);
    if (pathname === homeHref || pathname.startsWith(`${homeHref}?`)) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      router.refresh();
      return;
    }
    router.push(homeHref);
  }

  const navLinks = isGuest
    ? [
        { href: "/home", label: "Live ECG", icon: Home },
        { href: "/login", label: "Sign in", icon: UserRound },
      ]
    : [
        { href: "/patients", label: "Patients", icon: Users },
        { href: "/account", label: "Account", icon: UserRound },
      ];

  return (
    <div className="relative isolate min-h-screen pb-20 sm:pb-0">
      <AmbientBackdrop variant="app" />
      {showNav && (
        <header className="glass-nav sticky top-0 z-40 border-b">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-5">
              <Link
                href={homeHref}
                onClick={goBrand}
                className="flex min-h-11 items-center gap-2.5 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="grid h-8 w-8 place-items-center rounded-sm border border-primary/35 bg-primary/10 text-primary">
                  <Activity className="h-4 w-4" aria-hidden />
                </span>
                <div className="leading-tight">
                  <p className="font-data text-sm font-medium tracking-tight text-foreground">CardioSense</p>
                  <p className="hidden text-sm text-muted-foreground sm:block">
                    {isGuest ? "Home monitoring" : "Console"}
                  </p>
                </div>
              </Link>
              <nav className="hidden items-center gap-1 sm:flex" aria-label="Primary">
                {navLinks.map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} className={cn(link(href), "rounded-sm px-2")}>
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    {label}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-2">
              {isGuest && (
                <Badge variant="demo" className="hidden rounded-sm font-data font-normal sm:inline-flex">
                  Guest
                </Badge>
              )}
              {modelStatus && (
                <span className="hidden max-w-[14rem] truncate font-data text-sm text-muted-foreground lg:inline">
                  {modelStatus}
                </span>
              )}
              {userName && (
                <span className="hidden max-w-[8rem] truncate text-sm text-muted-foreground md:inline">
                  {userName}
                </span>
              )}
              {onLogout && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onLogout}
                  className="hidden min-h-11 gap-1.5 rounded-sm sm:inline-flex"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden />
                  {isGuest ? "Exit" : "Log out"}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-11 min-w-11 rounded-sm p-0 sm:hidden"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
              >
                {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>
          {menuOpen && (
            <div className="glass border-0 border-t border-border/40 px-4 py-3 sm:hidden">
              <nav className="flex flex-col gap-1" aria-label="Mobile">
                {navLinks.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(link(href), "rounded-sm px-3")}
                    onClick={() => setMenuOpen(false)}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {label}
                  </Link>
                ))}
                {onLogout && (
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-sm px-3 text-left text-sm text-muted-foreground"
                    onClick={() => {
                      setMenuOpen(false);
                      onLogout();
                    }}
                  >
                    <LogOut className="h-4 w-4" aria-hidden />
                    {isGuest ? "Exit" : "Log out"}
                  </button>
                )}
              </nav>
            </div>
          )}
        </header>
      )}

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-7">{children}</div>

      <footer className="relative z-10 mx-auto max-w-6xl border-t border-border/50 px-4 py-4 font-data text-sm text-muted-foreground sm:px-6">
        Research demo · not a medical device · decision support only
      </footer>

      {showNav && (
        <nav
          className="glass-nav fixed inset-x-0 bottom-0 z-40 border-t sm:hidden"
          aria-label="Bottom"
        >
          <div className="mx-auto flex max-w-6xl items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
            {navLinks.slice(0, 3).map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-sm",
                  pathname.startsWith(href) ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {label}
              </Link>
            ))}
          </div>
        </nav>
      )}

      {showAssistant && <DrAimeChathead />}
    </div>
  );
}
