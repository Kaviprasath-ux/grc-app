"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComplianceData {
  framework: string;
  compliant: number;
  nonCompliant: number;
}

interface ComplianceProgressCardProps {
  data: ComplianceData[];
  maxItems?: number;
  viewAllHref?: string;
  className?: string;
}

function getComplianceColor(percentage: number) {
  if (percentage >= 70) return { bar: "bg-compliance-compliant", text: "text-compliance-compliant" };
  if (percentage >= 40) return { bar: "bg-warning", text: "text-warning-dark" };
  return { bar: "bg-compliance-non-compliant", text: "text-compliance-non-compliant" };
}

export function ComplianceProgressCard({
  data,
  maxItems = 5,
  viewAllHref = "/compliance/framework",
  className
}: ComplianceProgressCardProps) {
  // Calculate stats
  const totalFrameworks = data.length;
  const percentages = data.map(item => {
    const total = item.compliant + item.nonCompliant;
    return total > 0 ? Math.round((item.compliant / total) * 100) : 0;
  });
  const avgCompliance = totalFrameworks > 0
    ? Math.round(percentages.reduce((a, b) => a + b, 0) / totalFrameworks)
    : 0;

  // Sort by compliance percentage (highest first)
  const sortedData = [...data].map((item, index) => ({
    ...item,
    percentage: percentages[index]
  })).sort((a, b) => b.percentage - a.percentage);

  // Limit to maxItems
  const displayData = sortedData.slice(0, maxItems);
  const remainingCount = totalFrameworks - maxItems;

  return (
    <Card className={cn("h-full flex flex-col", className)}>
      <CardHeader className="pb-3">
        <h3 className="text-base font-medium text-text-primary">Compliance Status</h3>
      </CardHeader>
      <CardContent className="pt-0 flex-1 flex flex-col">
        <div className="space-y-3 flex-1">
          {displayData.map((item, index) => {
            const colors = getComplianceColor(item.percentage);
            return (
              <div key={index} className="group">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-text-primary truncate pr-2">
                    {item.framework}
                  </span>
                  <span className={cn("text-sm font-semibold tabular-nums", colors.text)}>
                    {item.percentage}%
                  </span>
                </div>
                <div className="h-2 bg-surface-tertiary rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500 ease-out",
                      colors.bar
                    )}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            );
          })}

          {data.length === 0 && (
            <div className="text-center py-8 text-text-secondary text-sm">
              No compliance data available
            </div>
          )}
        </div>

        {/* View All Link */}
        {remainingCount > 0 && (
          <div className="pt-4 mt-auto border-t border-border-light">
            <Link
              href={viewAllHref}
              className="flex items-center justify-between text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              <span>View all {totalFrameworks} frameworks</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
