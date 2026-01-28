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
import { cn } from "@/lib/utils";

interface StackedBarChartProps {
  title: string;
  data: Record<string, unknown>[];
  bars: {
    dataKey: string;
    fill: string;
    name: string;
  }[];
  yAxisDataKey: string;
  layout?: "horizontal" | "vertical";
  className?: string;
}

export function StackedBarChart({
  title,
  data,
  bars,
  yAxisDataKey,
  layout = "vertical",
  className,
}: StackedBarChartProps) {
  const isVertical = layout === "vertical";

  // Dynamic height based on number of items (minimum 200px)
  // For vertical layout (horizontal bars): height grows with more items
  // For horizontal layout (vertical bars): fixed height since bars are side by side
  const minBarHeight = 45; // Space per bar category
  const chartHeight = isVertical
    ? Math.max(200, data.length * minBarHeight)
    : 200;

  return (
    <div className={cn(
      "bg-white rounded-xl border border-slate-200 p-4",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>

      {/* Legend - compact row */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        {bars.map((bar) => (
          <div key={bar.dataKey} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: bar.fill }}
            />
            <span className="text-xs text-slate-600">{bar.name}</span>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div style={{ height: `${chartHeight}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout={isVertical ? "vertical" : "horizontal"}
            data={data}
            margin={{ top: 5, right: 10, left: isVertical ? 0 : -5, bottom: 5 }}
            barCategoryGap="25%"
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e2e8f0"
              horizontal={!isVertical}
              vertical={isVertical}
            />
            {isVertical ? (
              <>
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  tickCount={5}
                />
                <YAxis
                  dataKey={yAxisDataKey}
                  type="category"
                  width={70}
                  tick={{ fontSize: 11, fill: "#475569", fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                />
              </>
            ) : (
              <>
                <XAxis
                  dataKey={yAxisDataKey}
                  tick={{ fontSize: 11, fill: "#475569", fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  width={25}
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  tickCount={5}
                />
              </>
            )}
            <Tooltip
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                fontSize: "12px",
                padding: "8px 12px",
              }}
              itemStyle={{ color: "#334155", padding: "2px 0" }}
              cursor={{ fill: "rgba(99, 102, 241, 0.05)" }}
            />
            {bars.map((bar, index) => (
              <Bar
                key={bar.dataKey}
                dataKey={bar.dataKey}
                fill={bar.fill}
                name={bar.name}
                stackId="a"
                barSize={isVertical ? 18 : 40}
                radius={[0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
