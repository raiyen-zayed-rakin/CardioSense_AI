"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type DialogCtx = { open: boolean; setOpen: (v: boolean) => void };
const Ctx = React.createContext<DialogCtx | null>(null);

export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={{ open, setOpen: onOpenChange }}>{children}</Ctx.Provider>;
}

export function DialogTrigger({
  asChild,
  children,
}: {
  asChild?: boolean;
  children: React.ReactElement;
}) {
  const ctx = React.useContext(Ctx);
  if (!ctx) return children;
  if (asChild) {
    return React.cloneElement(children, {
      onClick: (e: React.MouseEvent) => {
        children.props.onClick?.(e);
        ctx.setOpen(true);
      },
    });
  }
  return (
    <Button type="button" onClick={() => ctx.setOpen(true)}>
      {children}
    </Button>
  );
}

export function DialogContent({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  const ctx = React.useContext(Ctx);
  if (!ctx?.open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Close"
        onClick={() => ctx.setOpen(false)}
      />
      <div
        role="dialog"
        aria-modal
        className={cn(
          "glass-strong relative z-10 w-full max-w-lg rounded-lg p-6",
          className,
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          {title ? <h2 className="text-lg font-semibold tracking-tight">{title}</h2> : <span />}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => ctx.setOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
