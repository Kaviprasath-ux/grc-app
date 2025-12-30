"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  label: string;
  value: number | string;
  href?: string;
  className?: string;
}

export function StatsCard({ label, value, href, className }: StatsCardProps) {
  const content = (
    <div
      className={cn(
        "flex flex-col justify-center p-6 bg-grc-bg rounded-none cursor-pointer hover:shadow-md transition-shadow",
        "min-w-[175px] min-h-[116px]",
        className
      )}
    >
      <span className="text-sm text-grc-text mb-2">{label}</span>
      <span className="text-3xl font-bold text-grc-text">{value}</span>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
