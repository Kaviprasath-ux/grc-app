"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";

interface ComplianceItem {
  frameworkId?: string;
  framework: string;
  compliant: number;
  nonCompliant: number;
}

interface ComplianceProgressBarProps {
  title: string;
  data: ComplianceItem[];
  className?: string;
  maxItems?: number;
  onFrameworkClick?: (frameworkId: string) => void;
}

export function ComplianceProgressBar({ title, data, className, maxItems = 5, onFrameworkClick }: ComplianceProgressBarProps) {
  const [showAll, setShowAll] = useState(false);

  // Calculate compliance percentage for each framework
  const processedData = data.map(item => {
    const total = item.compliant + item.nonCompliant;
    const percentage = total > 0 ? Math.round((item.compliant / total) * 100) : 0;
    return {
      ...item,
      percentage,
      total,
    };
  });

  // Sort by compliance percentage (lowest first to highlight areas needing attention)
  const sortedData = [...processedData].sort((a, b) => a.percentage - b.percentage);

  // Show limited or all items
  const displayData = showAll ? sortedData : sortedData.slice(0, maxItems);
  const hasMore = sortedData.length > maxItems;

  // Get color based on percentage
  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return "bg-emerald-500";
    if (percentage >= 60) return "bg-amber-500";
    return "bg-red-500";
  };

  const getTextColor = (percentage: number) => {
    if (percentage >= 80) return "text-emerald-600";
    if (percentage >= 60) return "text-amber-600";
    return "text-red-600";
  };

  // Calculate overall compliance
  const totalCompliant = data.reduce((sum, item) => sum + item.compliant, 0);
  const totalNonCompliant = data.reduce((sum, item) => sum + item.nonCompliant, 0);
  const overallTotal = totalCompliant + totalNonCompliant;
  const overallPercentage = overallTotal > 0 ? Math.round((totalCompliant / overallTotal) * 100) : 0;

  return (
    <div className={cn(
      "bg-white rounded-xl border border-slate-200 p-3 sm:p-5",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-50">
          <span className="text-xs text-slate-500">Overall:</span>
          <span className={cn("text-sm font-bold", getTextColor(overallPercentage))}>
            {overallPercentage}%
          </span>
        </div>
      </div>

      {/* Progress Bars */}
      <div className="space-y-3">
        {displayData.map((item, index) => {
          const content = (
            <>
              {/* Label Row */}
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-600 font-medium truncate pr-4">
                  {item.framework}
                </span>
                <span className={cn(
                  "text-xs font-semibold tabular-nums",
                  getTextColor(item.percentage)
                )}>
                  {item.percentage}%
                </span>
              </div>
              {/* Progress Bar */}
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500 ease-out",
                    getProgressColor(item.percentage)
                  )}
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </>
          );

          return onFrameworkClick && item.frameworkId ? (
            <button
              key={index}
              onClick={() => onFrameworkClick(item.frameworkId!)}
              className="group w-full text-left p-2 -m-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              {content}
            </button>
          ) : (
            <div key={index} className="group">
              {content}
            </div>
          );
        })}
      </div>

      {/* View All / View Less */}
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="flex items-center justify-center gap-1 w-full mt-4 pt-3 border-t border-slate-100 text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors"
        >
          {showAll ? (
            <>
              Show Less <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              View All ({sortedData.length}) <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      )}
    </div>
  );
}
