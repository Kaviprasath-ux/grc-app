"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";

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
  onClick?: () => void;
}

export function DonutChart({ title, data, centerLabel, centerSubLabel, className, onClick }: DonutChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div
      className={cn(
        "bg-white rounded-xl border border-slate-200 p-5 overflow-visible",
        onClick && "cursor-pointer hover:bg-slate-50 transition-colors",
        className
      )}
      onClick={onClick}
    >
      {/* Header */}
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <span className="text-xs text-slate-400">
            {data.length} {data.length === 1 ? 'item' : 'items'}
          </span>
        </div>
      )}

      <div className="flex items-center gap-6 overflow-visible">
        {/* Chart container - left side */}
        <div className="relative w-[180px] h-[180px] flex-shrink-0 overflow-visible">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={54}
                outerRadius={84}
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    className="transition-opacity hover:opacity-80"
                  />
                ))}
              </Pie>
              <Tooltip
                wrapperStyle={{ zIndex: 50 }}
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                  fontSize: "12px",
                  padding: "8px 12px",
                }}
                itemStyle={{ color: "#334155" }}
                formatter={(value, name) => [`${value ?? 0} (${total > 0 && value ? (((value as number) / total) * 100).toFixed(0) : 0}%)`, name as string]}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          {(centerLabel !== undefined || centerSubLabel) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              {centerLabel !== undefined && (
                <span className="text-3xl font-bold text-slate-800">{centerLabel}</span>
              )}
              {centerSubLabel && (
                <span className="text-xs text-slate-500 font-medium">{centerSubLabel}</span>
              )}
            </div>
          )}
        </div>

        {/* Legend - right side with full names */}
        <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-2">
          {data.map((item, index) => {
            const percentage = total > 0 ? ((item.value / total) * 100).toFixed(0) : 0;
            return (
              <div key={index} className="flex items-center gap-2 group cursor-default">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs text-slate-600 truncate flex-1" title={item.name}>
                  {item.name}
                </span>
                <span className="text-xs font-semibold text-slate-700 tabular-nums">
                  {item.value}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
