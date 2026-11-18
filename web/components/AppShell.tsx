"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, Home, LogOut, Menu, UserRound, Users, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { DrAimeChathead } from "@/components/DrAimeChathead";

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
      pathname.startsWith(href) ? "text-foreground" : "text-muted-foreground",
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
    <div className="min-h-screen pb-20 sm:pb-0">
      {showNav && (
        <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-4">
              <Link
                href={homeHref}
                onClick={goBrand}
                className="flex min-h-11 items-center gap-2.5 rounded-md outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/15 text-primary">
                  <Activity className="h-4 w-4" aria-hidden />
                </span>
                <div className="leading-tight">
                  <p className="text-sm font-semibold tracking-tight">CardioSense AI</p>
                  <p className="hidden text-xs uppercase tracking-[0.14em] text-muted-foreground sm:block">
                    {isGuest ? "Home monitoring" : "Monitoring console"}
                  </p>
                </div>
              </Link>
              <nav className="hidden items-center gap-3 sm:flex" aria-label="Primary">
                {navLinks.map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} className={link(href)}>
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    {label}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-2">
              {isGuest && (
                <Badge variant="demo" className="hidden font-normal sm:inline-flex">
                  Guest
                </Badge>
              )}
              {modelStatus && (
                <Badge variant="outline" className="hidden max-w-[12rem] truncate font-normal lg:inline-flex">
                  {modelStatus}
                </Badge>
              )}
              {userName && (
                <span className="hidden max-w-[8rem] truncate text-sm text-muted-foreground md:inline">
                  {userName}
                </span>
              )}
              {onLogout && (
                <Button variant="ghost" size="sm" onClick={onLogout} className="hidden min-h-11 gap-1.5 sm:inline-flex">
                  <LogOut className="h-3.5 w-3.5" aria-hidden />
                  {isGuest ? "Exit" : "Log out"}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-11 min-w-11 p-0 sm:hidden"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
              >
                {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>
          {menuOpen && (
            <div className="border-t border-border/60 bg-background/95 px-4 py-3 sm:hidden">
              <nav className="flex flex-col gap-1" aria-label="Mobile">
                {navLinks.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(link(href), "rounded-md px-3")}
                    onClick={() => setMenuOpen(false)}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {label}
                  </Link>
                ))}
                {onLogout && (
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-left text-sm text-muted-foreground"
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

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
      <Separator className="opacity-40" />
      <footer className="mx-auto max-w-6xl px-4 py-4 text-sm text-muted-foreground sm:px-6">
        Research demo · not a medical device · decision support only
      </footer>

      {/* Mobile bottom nav — primary destinations only */}
      {showNav && (
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 backdrop-blur-xl sm:hidden"
          aria-label="Bottom"
        >
          <div className="mx-auto flex max-w-6xl items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
            {navLinks.slice(0, 3).map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs",
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
