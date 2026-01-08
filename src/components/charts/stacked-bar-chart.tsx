"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250}>
            <BarChart
              layout={isVertical ? "vertical" : "horizontal"}
              data={data}
              margin={{ top: 5, right: 30, left: isVertical ? 80 : 5, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              {isVertical ? (
                <>
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                  <YAxis
                    dataKey={yAxisDataKey}
                    type="category"
                    width={75}
                    tick={{ fontSize: 12 }}
                  />
                </>
              ) : (
                <>
                  <XAxis dataKey={yAxisDataKey} />
                  <YAxis />
                </>
              )}
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
              />
              <Legend />
              {bars.map((bar) => (
                <Bar
                  key={bar.dataKey}
                  dataKey={bar.dataKey}
                  fill={bar.fill}
                  name={bar.name}
                  stackId="a"
                  barSize={20}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
