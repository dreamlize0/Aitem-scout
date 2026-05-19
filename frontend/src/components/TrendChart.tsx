"use client";

import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import type { TrendPoint } from "@/lib/types";

interface Props {
  data?: TrendPoint[];
}

const FALLBACK_DATA: TrendPoint[] = [
  { label: "1주전", value: 30 },
  { label: "6일전", value: 45 },
  { label: "5일전", value: 42 },
  { label: "4일전", value: 60 },
  { label: "3일전", value: 75 },
  { label: "어제", value: 85 },
  { label: "오늘", value: 100 },
];

export default function TrendChart({ data }: Props) {
  const chartData = data && data.length > 0 ? data : FALLBACK_DATA;

  return (
    <div className="h-48 w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-accent-green)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--color-accent-green)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="var(--color-muted)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="var(--color-muted)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
              borderRadius: "8px",
            }}
            itemStyle={{ color: "var(--color-accent-green)" }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--color-accent-green)"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorScore)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
