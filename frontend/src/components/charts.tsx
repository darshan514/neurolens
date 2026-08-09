import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import type { TestId, TrendPoint } from "../lib/types";
import { TEST_META } from "../lib/types";

const GRID = "rgba(255,255,255,0.06)";
const AXIS = "#94a3b8";

function tooltipStyle() {
  return {
    backgroundColor: "#0b1120",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 12,
    fontSize: 12,
    color: "#e2e8f0",
  };
}

export function DomainRadar({
  scores,
  height = 260,
}: {
  scores: Record<TestId, number>;
  height?: number;
}) {
  const data = (Object.keys(scores) as TestId[]).map((id) => ({
    domain: TEST_META[id].short,
    score: scores[id],
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke={GRID} />
        <PolarAngleAxis dataKey="domain" tick={{ fill: AXIS, fontSize: 11 }} />
        <Radar dataKey="score" stroke="#4a6ef0" fill="#4a6ef0" fillOpacity={0.35} strokeWidth={2} />
        <Tooltip contentStyle={tooltipStyle()} formatter={(v: unknown) => [`${String(v)}/100`, "Score"]} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function TrendChart({
  points,
  series,
  height = 240,
}: {
  points: TrendPoint[];
  series: Array<{ key: string; name: string; color: string }>;
  height?: number;
}) {
  const data = points.map((p) => {
    const row: Record<string, number | string> = { label: p.label };
    for (const s of series) {
      row[s.key] = s.key === "overall" ? p.overall : p.domainScores[s.key as TestId];
    }
    return row;
  });
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle()} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CompareBars({
  data,
  colors,
  height = 220,
}: {
  data: Array<Record<string, string | number>>;
  colors: string[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }} barGap={4}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle()} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {Object.keys(data[0] ?? {})
          .filter((k) => k !== "name")
          .map((k, i) => (
            <Bar key={k} dataKey={k} fill={colors[i % colors.length]} radius={[6, 6, 0, 0]} maxBarSize={28} />
          ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
