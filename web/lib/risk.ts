import type { BadgeProps } from "@/components/ui/badge";

export function riskVariant(band: string): BadgeProps["variant"] {
  switch (band) {
    case "green":
      return "success";
    case "amber":
      return "warning";
    case "orange":
    case "red":
      return "danger";
    default:
      return "secondary";
  }
}

export function riskLabel(band: string) {
  switch (band) {
    case "green":
      return "Green — Normal";
    case "amber":
      return "Amber — Watch";
    case "orange":
      return "Orange — Urgent";
    case "red":
      return "Red — Critical";
    default:
      return band.charAt(0).toUpperCase() + band.slice(1);
  }
}

export function riskBarClass(band: string) {
  switch (band) {
    case "green":
      return "bg-primary";
    case "amber":
      return "bg-[hsl(var(--warning))]";
    case "orange":
      return "bg-[hsl(var(--orange))]";
    case "red":
      return "bg-destructive";
    default:
      return "bg-muted-foreground";
  }
}
