"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

interface ComplianceData {
  framework: string;
  compliant: number;
  nonCompliant: number;
}

interface ComplianceProgressListProps {
  title: string;
  subtitle?: string;
  data: ComplianceData[];
  className?: string;
  limit?: number;
  viewAllHref?: string;
}

export function ComplianceProgressList({
  title,
  subtitle,
  data,
  className,
  limit = 5,
  viewAllHref,
}: ComplianceProgressListProps) {
  // Sort by lowest compliance first (most critical)
  const sortedData = [...data].sort((a, b) => a.compliant - b.compliant);
  const displayData = sortedData.slice(0, limit);
  const hasMore = data.length > limit;

  return (
    <div
      className={cn(
        "bg-surface-primary rounded-2xl flex flex-col",
        "border border-neutral-slate-100",
        "shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
        "hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]",
        "transition-all duration-300",
        className
      )}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-4 shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
            {subtitle && (
              <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>
            )}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-semantic-success" />
              <span className="text-xs text-text-secondary">Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-semantic-error" />
              <span className="text-xs text-text-secondary">Non Compliant</span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress List */}
      <div className="px-5 pb-4 space-y-3 flex-1">
        {displayData.map((item, index) => (
          <div key={index} className="flex items-center gap-3 group">
            {/* Framework Name */}
            <div className="w-28 shrink-0">
              <span className="text-xs font-medium text-text-secondary truncate block group-hover:text-text-primary transition-colors" title={item.framework}>
                {item.framework}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="flex-1 h-2 bg-neutral-slate-100 rounded-full overflow-hidden">
              <div className="h-full flex">
                <div
                  className="h-full bg-semantic-success rounded-l-full transition-all duration-500"
                  style={{ width: `${item.compliant}%` }}
                />
                <div
                  className="h-full bg-semantic-error transition-all duration-500"
                  style={{ width: `${item.nonCompliant}%` }}
                />
              </div>
            </div>

            {/* Percentage */}
            <div className="w-10 shrink-0 text-right">
              <span className={cn(
                "text-xs font-semibold tabular-nums",
                item.compliant >= 70 ? "text-semantic-success-dark" :
                item.compliant >= 40 ? "text-semantic-warning-dark" :
                "text-semantic-error-dark"
              )}>
                {item.compliant}%
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* View All Footer */}
      {hasMore && viewAllHref && (
        <div className="px-5 py-3 border-t border-neutral-slate-100 shrink-0">
          <Link
            href={viewAllHref}
            className="flex items-center justify-center gap-1.5 text-xs font-medium text-primary-indigo-600 hover:text-primary-indigo-700 transition-colors group"
          >
            View All {data.length} Frameworks
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      )}
    </div>
  );
}
