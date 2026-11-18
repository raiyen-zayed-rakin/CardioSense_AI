"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2, Send, X } from "lucide-react";
import { api, AssistantSuggestion } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string; source?: string };

function nudgeLines(pathname: string): string[] {
  if (pathname.startsWith("/home")) {
    return [
      "Need a hand with your live ECG?",
      "Curious what N / S / V / F mean?",
      "Let’s chat — I can walk you through this screen.",
      "Stuck on Start replay? Ask me.",
    ];
  }
  if (pathname.startsWith("/monitor")) {
    return [
      "Want a quick tour of this monitor?",
      "I can explain the rhythm and risk panels.",
      "Questions about the ECG strip? Tap me.",
      "Let’s chat if something looks unclear.",
    ];
  }
  if (pathname.startsWith("/patients")) {
    return [
      "Need help adding a patient?",
      "I can explain how to start a monitor.",
      "Got a minute? Let’s chat.",
      "Not sure what an MRN is? Ask away.",
    ];
  }
  return [
    "Need anything? I’m here.",
    "Let’s chat — product questions welcome.",
    "Stuck? Tap me for a quick tip.",
  ];
}

export function DrAimeChathead() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [nudge, setNudge] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AssistantSuggestion[]>([]);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hi — I’m Dr. Aime. I can walk you through patients, live replay, and beat labels. I don’t diagnose or prescribe.",
    },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nudgeIndex = useRef(0);
  const hideNudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    setNudge(null);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    inputRef.current?.focus();
  }, [open, messages, busy]);

  useEffect(() => {
    if (open) return;

    const showNudge = () => {
      const lines = nudgeLines(pathname);
      const text = lines[nudgeIndex.current % lines.length];
      nudgeIndex.current += 1;
      setNudge(text);
      if (hideNudgeTimer.current) clearTimeout(hideNudgeTimer.current);
      hideNudgeTimer.current = setTimeout(() => setNudge(null), 7000);
    };

    const first = setTimeout(showNudge, 9000);
    const interval = setInterval(showNudge, 55000);

    return () => {
      clearTimeout(first);
      clearInterval(interval);
      if (hideNudgeTimer.current) clearTimeout(hideNudgeTimer.current);
    };
  }, [open, pathname]);

  useEffect(() => {
    if (!open) return;
    api
      .assistantSuggestions(pathname)
      .then(setSuggestions)
      .catch(() => {
        const onMonitor = pathname.startsWith("/monitor");
        setSuggestions(
          onMonitor
            ? [
                { id: "ecg-strip", label: "What is the ECG strip?" },
                { id: "monitor-sections", label: "What do the monitor sections mean?" },
                { id: "pause-stop", label: "Can I pause replay?" },
                { id: "beat-labels", label: "What do the beat labels mean?" },
                { id: "cannot-do", label: "What can't Dr. Aime do?" },
              ]
            : [
                { id: "start-monitor", label: "How do I start a live monitor?" },
                { id: "beat-labels", label: "What do the beat labels mean?" },
                { id: "add-patient", label: "How do I add a patient?" },
                { id: "what-is-mrn", label: "What is an MRN?" },
                { id: "cannot-do", label: "What can't Dr. Aime do?" },
              ],
        );
      });
  }, [open, pathname]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setInput("");
    const history = messages
      .filter((m) => m.content)
      .map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: message }, { role: "assistant", content: "" }]);
    setBusy(true);
    try {
      await api.assistantChatStream(
        { message, page: pathname, history },
        {
          onToken: (token) => {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "assistant") {
                next[next.length - 1] = { ...last, content: last.content + token };
              }
              return next;
            });
          },
          onReplace: (full) => {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "assistant") {
                next[next.length - 1] = { ...last, content: full };
              }
              return next;
            });
          },
          onDone: (source) => {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "assistant") {
                next[next.length - 1] = {
                  ...last,
                  content: last.content || "I couldn’t reach the assistant just now. Try a suggested question.",
                  source,
                };
              }
              return next;
            });
          },
        },
      );
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Request failed";
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant") {
          next[next.length - 1] = { ...last, content: detail, source: "error" };
        }
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  function openChat() {
    setNudge(null);
    setOpen(true);
  }

  return (
    <>
      {!open && nudge && (
        <div
          className={cn(
            "fixed bottom-36 right-4 z-50 max-w-[16rem] sm:bottom-[8.75rem] sm:right-8",
            "motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300",
          )}
        >
          <button
            type="button"
            onClick={openChat}
            className={cn(
              "relative w-full rounded-2xl rounded-br-md border border-[hsl(var(--aime-border))] bg-[hsl(var(--aime))] px-3.5 py-2.5 text-left",
              "text-sm leading-snug text-[hsl(var(--aime-foreground))] shadow-[0_12px_32px_-14px_rgba(0,0,0,0.55)]",
              "transition hover:brightness-[1.02]",
            )}
          >
            <span className="pr-5 font-medium">{nudge}</span>
            <span
              role="presentation"
              className="absolute -bottom-1.5 right-6 h-3 w-3 rotate-45 border-b border-r border-[hsl(var(--aime-border))] bg-[hsl(var(--aime))]"
            />
          </button>
          <button
            type="button"
            aria-label="Dismiss tip"
            onClick={() => setNudge(null)}
            className="absolute -right-1 -top-1 grid h-11 w-11 place-items-center rounded-full border border-border/70 bg-card text-muted-foreground shadow-sm hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <button
        type="button"
        aria-label={open ? "Close Dr. Aime" : "Open Dr. Aime"}
        onClick={() => (open ? setOpen(false) : openChat())}
        className={cn(
          "fixed bottom-24 right-4 z-50 grid h-[4.5rem] w-[4.5rem] place-items-center overflow-hidden rounded-full p-1 sm:bottom-8 sm:right-8",
          "border border-[hsl(var(--aime-border))] bg-[hsl(var(--aime))]",
          "shadow-[0_12px_40px_-12px_rgba(0,0,0,0.65)]",
          "ring-2 ring-[hsl(var(--warning)/0.35)] transition duration-300 hover:scale-105 hover:ring-[hsl(var(--warning)/0.55)]",
        )}
      >
        <Image
          src="/dr-aime-avatar.jpg"
          alt="Dr. Aime"
          width={72}
          height={72}
          className="h-full w-full rounded-full object-cover"
          priority
        />
      </button>

      <div
        className={cn(
          "fixed right-4 z-50 flex w-[min(100vw-2rem,22rem)] flex-col overflow-hidden rounded-2xl sm:right-8",
          "glass-strong shadow-[0_24px_60px_-20px_rgba(0,0,0,0.75)]",
          "origin-bottom-right transition-all duration-300",
          open ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
        )}
        style={{ bottom: "calc(6.5rem + env(safe-area-inset-bottom, 0px))" }}
        aria-hidden={!open}
      >
        <header className="flex items-center gap-3 border-b border-border/70 bg-secondary/40 px-3 py-2.5">
          <Image
            src="/dr-aime-avatar.jpg"
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 rounded-full object-cover ring-2 ring-[hsl(var(--aime))]"
          />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-semibold">Dr. Aime</p>
            <p className="truncate text-sm text-muted-foreground">Guide · not a diagnosis</p>
          </div>
          <Button variant="ghost" size="sm" className="min-h-11 min-w-11 p-0" onClick={() => setOpen(false)} aria-label="Close chat">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="flex max-h-[min(60vh,28rem)] flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.map((m, i) => (
              <div
                key={`${i}-${m.role}`}
                className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                    m.role === "user"
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md bg-secondary/80 text-foreground",
                  )}
                >
                  {m.content || (busy && i === messages.length - 1 ? (
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Thinking…
                    </span>
                  ) : null)}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-border/50 px-3 py-2">
            <p className="mb-1.5 text-sm text-muted-foreground">Suggested</p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={busy}
                  onClick={() => send(s.label)}
                  className="min-h-11 rounded-full border border-border/80 bg-background/60 px-3 py-1.5 text-left text-sm text-muted-foreground transition hover:border-primary/50 hover:text-foreground disabled:opacity-50"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <form
            className="flex items-center gap-2 border-t border-border/70 p-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Dr. Aime…"
              disabled={busy}
              className="h-11 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            />
            <Button
              type="submit"
              size="sm"
              disabled={busy || !input.trim()}
              className="min-h-11 min-w-11 p-0"
              aria-label="Send message"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
