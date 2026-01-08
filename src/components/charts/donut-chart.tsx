"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DonutChartData {
  name: string;
  value: number;
  color: string;
  [key: string]: string | number;
}

interface DonutChartProps {
  title?: string;
  data: DonutChartData[];
  centerLabel?: string | number;
  centerSubLabel?: string;
  className?: string;
}

export function DonutChart({ title, data, centerLabel, centerSubLabel, className }: DonutChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[220px] relative flex">
          {/* Chart container - left side */}
          <div className="relative w-[140px] h-full flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%" minHeight={220}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={60}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "6px",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label - positioned relative to chart container */}
            {(centerLabel !== undefined || centerSubLabel) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                {centerLabel !== undefined && (
                  <span className="text-xl font-bold text-grc-text">{centerLabel}</span>
                )}
                {centerSubLabel && (
                  <span className="text-xs text-muted-foreground">{centerSubLabel}</span>
                )}
              </div>
            )}
          </div>
          {/* Legend - right side */}
          <div className="flex-1 flex flex-col justify-center pl-2 min-w-0">
            {data.map((item, index) => (
              <div key={index} className="flex items-center gap-2 py-1">
                <div
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-grc-text truncate">
                  {item.name}: {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
