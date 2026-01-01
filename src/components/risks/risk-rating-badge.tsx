"use client";

import { cn } from "@/lib/utils";

interface RiskRatingBadgeProps {
  rating: string;
  className?: string;
}

// Rating colors matching website: Catastrophic, Very high, High, Low Risk
const ratingColors: Record<string, { bg: string; text: string }> = {
  Catastrophic: { bg: "bg-red-600", text: "text-white" },
  "Very high": { bg: "bg-orange-500", text: "text-white" },
  High: { bg: "bg-amber-500", text: "text-white" },
  "Low Risk": { bg: "bg-green-500", text: "text-white" },
};

export function RiskRatingBadge({ rating, className }: RiskRatingBadgeProps) {
  const colors = ratingColors[rating] || { bg: "bg-gray-400", text: "text-white" };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        colors.bg,
        colors.text,
        className
      )}
    >
      {rating}
    </span>
  );
}
