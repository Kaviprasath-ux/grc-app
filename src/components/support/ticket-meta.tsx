"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const PRIORITY_OPTIONS = ["P1", "P2", "P3", "P4"] as const;
export const TIER_OPTIONS = ["L1", "L2", "L3", "L4"] as const;
export const SEVERITY_OPTIONS = ["Critical", "High", "Medium", "Low"] as const;
export const STATUS_OPTIONS = [
  "New",
  "Open",
  "In Progress",
  "Pending Customer",
  "Resolved",
  "Closed",
  "Reopened",
] as const;
export const CHANNEL_OPTIONS = ["InApp", "Chatbot", "Email", "WhatsApp", "Phone"] as const;

const PRIORITY_CLASSES: Record<string, string> = {
  P1: "border-red-300 bg-red-50 text-red-700",
  P2: "border-orange-300 bg-orange-50 text-orange-700",
  P3: "border-blue-300 bg-blue-50 text-blue-700",
  P4: "border-slate-300 bg-slate-50 text-slate-700",
};

const STATUS_CLASSES: Record<string, string> = {
  New: "border-violet-300 bg-violet-50 text-violet-700",
  Open: "border-blue-300 bg-blue-50 text-blue-700",
  "In Progress": "border-yellow-300 bg-yellow-50 text-yellow-700",
  "Pending Customer": "border-amber-300 bg-amber-50 text-amber-700",
  Resolved: "border-green-300 bg-green-50 text-green-700",
  Closed: "border-slate-300 bg-slate-50 text-slate-700",
  Reopened: "border-rose-300 bg-rose-50 text-rose-700",
};

const TIER_CLASSES: Record<string, string> = {
  L1: "border-emerald-300 bg-emerald-50 text-emerald-700",
  L2: "border-cyan-300 bg-cyan-50 text-cyan-700",
  L3: "border-indigo-300 bg-indigo-50 text-indigo-700",
  L4: "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700",
};

export function PriorityBadge({ value, label }: { value: string; label?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", PRIORITY_CLASSES[value] || "")}>
      {label || value}
    </Badge>
  );
}

export function StatusBadge({ value, label }: { value: string; label?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", STATUS_CLASSES[value] || "")}>
      {label || value}
    </Badge>
  );
}

export function TierBadge({ value, label }: { value: string; label?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", TIER_CLASSES[value] || "")}>
      {label || value}
    </Badge>
  );
}

/** Whether an SLA deadline is breached or imminent, for the row chip. */
export function slaState(deadline: string | null | undefined, resolvedAt: string | null | undefined): "ok" | "soon" | "breached" | "none" {
  if (!deadline || resolvedAt) return "none";
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms < 0) return "breached";
  if (ms < 60 * 60 * 1000) return "soon"; // within 1 hour
  return "ok";
}
