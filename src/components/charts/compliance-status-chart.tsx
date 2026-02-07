"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ShieldCheck, TrendingUp, TrendingDown } from "lucide-react";
import { complianceColors } from "@/lib/colors";

interface ComplianceData {
  framework: string;
  compliant: number;
  nonCompliant: number;
}

interface ComplianceStatusChartProps {
  data: ComplianceData[];
  className?: string;
}

export function ComplianceStatusChart({ data, className }: ComplianceStatusChartProps) {
  // Calculate summary statistics
  const totalFrameworks = data.length;
  const avgCompliance = totalFrameworks > 0
    ? Math.round(data.reduce((sum, item) => sum + item.compliant, 0) / totalFrameworks)
    : 0;
  const fullyCompliant = data.filter(item => item.compliant === 100).length;

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; fill: string }>; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-surface-primary border border-border-light rounded-lg p-3 shadow-elevated">
          <p className="text-sm font-medium text-text-primary mb-2">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: entry.fill }}
              />
              <span className="text-text-secondary">{entry.name}:</span>
              <span className="font-medium text-text-primary">{entry.value}%</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className={cn("border-border-light shadow-card hover:shadow-card-hover transition-shadow duration-200", className)}>
      <CardContent className="p-0">
        {/* Header Section */}
        <div className="p-5 pb-4 border-b border-border-light">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-compliance-compliant-bg">
                <ShieldCheck className="w-5 h-5 text-compliance-compliant" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary">Overall Compliance Status</h3>
                <p className="text-sm text-text-secondary mt-0.5">Framework compliance overview</p>
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-text-primary">{totalFrameworks}</span>
              <span className="text-xs text-text-muted">Total Frameworks</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-bold text-compliance-compliant">{avgCompliance}%</span>
                {avgCompliance >= 50 ? (
                  <TrendingUp className="w-4 h-4 text-semantic-success" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-semantic-error" />
                )}
              </div>
              <span className="text-xs text-text-muted">Avg. Compliance</span>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-primary-indigo-600">{fullyCompliant}</span>
              <span className="text-xs text-text-muted">Fully Compliant</span>
            </div>
          </div>
        </div>

        {/* Chart Section */}
        <div className="p-5 pt-4">
          {/* Custom Legend */}
          <div className="flex items-center gap-6 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: complianceColors.compliant.main }} />
              <span className="text-sm text-text-secondary">Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: complianceColors["non-compliant"].main }} />
              <span className="text-sm text-text-secondary">Non Compliant</span>
            </div>
          </div>

          {/* Chart */}
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={data}
                margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                barCategoryGap="20%"
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#E2E8F0"
                  horizontal={true}
                  vertical={false}
                />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                  tick={{ fill: '#64748B', fontSize: 11 }}
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={{ stroke: '#CBD5E1' }}
                  ticks={[0, 25, 50, 75, 100]}
                />
                <YAxis
                  dataKey="framework"
                  type="category"
                  width={100}
                  tick={{ fill: '#334155', fontSize: 12, fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F1F5F9' }} />
                <Bar
                  dataKey="compliant"
                  stackId="a"
                  fill={complianceColors.compliant.main}
                  name="Compliant"
                  radius={[0, 0, 0, 0]}
                  barSize={16}
                />
                <Bar
                  dataKey="nonCompliant"
                  stackId="a"
                  fill={complianceColors["non-compliant"].main}
                  name="Non Compliant"
                  radius={[0, 4, 4, 0]}
                  barSize={16}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Framework Status Pills */}
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border-light">
            {data.map((item, index) => (
              <div
                key={index}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                  item.compliant === 100
                    ? "bg-compliance-compliant-bg text-semantic-success-dark"
                    : item.compliant >= 50
                      ? "bg-compliance-pending-bg text-semantic-warning-dark"
                      : "bg-compliance-non-compliant-bg text-semantic-error-dark"
                )}
              >
                <span>{item.framework}</span>
                <span className="font-semibold">{item.compliant}%</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
