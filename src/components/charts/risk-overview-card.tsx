"use client";

import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Circle } from "lucide-react";

interface RiskItem {
  category: string;
  total: number;
  closed: number;
}

interface RiskOverviewCardProps {
  title: string;
  data: RiskItem[];
  className?: string;
}

// Risk level colors based on category name
const getRiskStyles = (category: string) => {
  const lowerCategory = category.toLowerCase();
  if (lowerCategory.includes('catastrophic') || lowerCategory.includes('critical')) {
    return { bg: 'bg-red-500', bgLight: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' };
  }
  if (lowerCategory.includes('very high') || lowerCategory.includes('veryhigh')) {
    return { bg: 'bg-orange-500', bgLight: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' };
  }
  if (lowerCategory.includes('high')) {
    return { bg: 'bg-amber-500', bgLight: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
  }
  if (lowerCategory.includes('medium')) {
    return { bg: 'bg-yellow-500', bgLight: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' };
  }
  // Low or minimal
  return { bg: 'bg-emerald-500', bgLight: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
};

export function RiskOverviewCard({ title, data, className }: RiskOverviewCardProps) {
  // Calculate totals
  const totalRisks = data.reduce((sum, item) => sum + item.total, 0);
  const totalClosed = data.reduce((sum, item) => sum + item.closed, 0);
  const openRisks = totalRisks - totalClosed;
  const closedPercentage = totalRisks > 0 ? Math.round((totalClosed / totalRisks) * 100) : 0;

  // Sort by severity (we want critical/catastrophic first)
  const severityOrder = ['catastrophic', 'critical', 'very high', 'veryhigh', 'high', 'medium', 'low', 'minimal'];
  const sortedData = [...data].sort((a, b) => {
    const aIndex = severityOrder.findIndex(s => a.category.toLowerCase().includes(s));
    const bIndex = severityOrder.findIndex(s => b.category.toLowerCase().includes(s));
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });

  return (
    <div className={cn(
      "bg-white rounded-xl border border-slate-200 p-5 transition-all duration-200",
      "hover:shadow-lg hover:shadow-slate-200/50 hover:border-slate-300",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <Circle className="h-3 w-3 fill-slate-300 text-slate-300" />
            <span className="text-slate-500">Open: <span className="font-semibold text-slate-700">{openRisks}</span></span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            <span className="text-slate-500">Closed: <span className="font-semibold text-emerald-600">{totalClosed}</span></span>
          </div>
        </div>
      </div>

      {/* Risk Items */}
      <div className="space-y-3">
        {sortedData.map((item, index) => {
          const styles = getRiskStyles(item.category);
          const open = item.total - item.closed;
          const itemClosedPct = item.total > 0 ? Math.round((item.closed / item.total) * 100) : 0;

          return (
            <div key={index} className={cn("flex items-center gap-3 p-2.5 rounded-lg", styles.bgLight, styles.border, "border")}>
              {/* Risk Level Indicator */}
              <div className={cn("w-1.5 h-8 rounded-full", styles.bg)} />

              {/* Risk Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={cn("text-sm font-medium", styles.text)}>
                    {item.category}
                  </span>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">{open} open</span>
                    <span className="text-slate-300">|</span>
                    <span className="text-emerald-600">{item.closed} closed</span>
                  </div>
                </div>
                {/* Mini progress bar */}
                <div className="mt-1.5 h-1 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${itemClosedPct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Footer */}
      <div className="mt-4 pt-3 border-t border-slate-100">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Resolution Progress</span>
          <span className="font-semibold text-slate-700">{closedPercentage}% Complete</span>
        </div>
        <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${closedPercentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}
