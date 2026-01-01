"use client";

import { cn } from "@/lib/utils";

interface RiskStatusBadgeProps {
  status: string;
  className?: string;
}

// Status colors matching website: Awaiting Approval (black), Pending Assessment (blue), Open (red), In Progress (yellow), Closed (green)
const statusColors: Record<string, { bg: string; text: string }> = {
  "Awaiting Approval": { bg: "bg-gray-700", text: "text-white" },
  "Pending Assessment": { bg: "bg-blue-100", text: "text-blue-800" },
  Open: { bg: "bg-red-100", text: "text-red-800" },
  "In Progress": { bg: "bg-yellow-100", text: "text-yellow-800" },
  Closed: { bg: "bg-green-100", text: "text-green-800" },
};

export function RiskStatusBadge({ status, className }: RiskStatusBadgeProps) {
  const colors = statusColors[status] || { bg: "bg-gray-100", text: "text-gray-800" };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        colors.bg,
        colors.text,
        className
      )}
    >
      {status}
    </span>
  );
}
