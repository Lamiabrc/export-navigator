import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  BarChart,
  Bar,
  Rectangle,
} from "recharts";

export function NeonSurface({ className, children }: React.PropsWithChildren<{ className?: string }>) {
  return <div className={cn("neon-card rounded-xl p-4 text-slate-100", className)}>{children}</div>;
}

export function NeonKpiCard({
  label,
  value,
  delta,
  accent = "var(--chart-1)",
}: {
  label: string;
  value: string;
  delta?: number;
  accent?: string;
}) {
  return (
    <NeonSurface className="space-y-1">
      <div className="text-xs text-slate-300/80">{label}</div>
      <div className="flex items-end gap-2">
        <div className="text-2xl font-bold" style={{ color: accent }}>
          {value}
        </div>
        {delta !== undefined ? (
          <span className={cn("text-xs", delta >= 0 ? "text-emerald-300" : "text-rose-300")}>
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
          </span>
        ) : null}
      </div>
    </NeonSurface>
  );
}

export function NeonDonutCard({
  label,
  value,
  delta,
  color = "var(--chart-1)",
}: {
  label: string;
  value: number;
  delta?: number;
  color?: string;
}) {
  const data = [
    { name: label, value },
    { name: "rest", value: Math.max(0, 100 - value) },
  ];
  return (
    <NeonSurface className="flex items-center gap-3">
      <div className="h-[120px] w-[120px]">
        <ResponsiveContainer>
          <RadialBarChart innerRadius="60%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="value" cornerRadius={8} fill={color} background={{ fill: "rgba(255,255,255,0.06)" }} />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-1">
        <div className="text-sm text-slate-300/80">{label}</div>
        <div className="text-2xl font-semibold">{value.toFixed(0)}%</div>
        {delta !== undefined ? (
          <div className={cn("text-xs", delta >= 0 ? "text-emerald-300" : "text-rose-300")}>
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}% vs période
          </div>
        ) : null}
      </div>
    </NeonSurface>
  );
}

export function NeonBarCard({
  title,
  data,
  dataKey = "value",
  labelKey = "label",
}: {
  title: string;
  data: any[];
  dataKey?: string;
  labelKey?: string;
}) {
  return (
    <NeonSurface className="h-full">
      <div className="mb-2 text-sm text-slate-300/80">{title}</div>
      <div className="h-[180px]">
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ left: 12, right: 12 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis type="number" tick={{ fill: "#cbd5e1" }} axisLine={false} />
            <YAxis type="category" dataKey={labelKey} width={80} tick={{ fill: "#cbd5e1" }} axisLine={false} />
            <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)" }} />
            <Bar
              dataKey={dataKey}
              radius={6}
              fill="url(#barGradient)"
              barSize={14}
              activeBar={<Rectangle fill="rgba(60,193,255,0.6)" stroke="rgba(60,193,255,0.8)" />}
            />
            <defs>
              <linearGradient id="barGradient" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.8} />
                <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.9} />
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </NeonSurface>
  );
}

export function NeonLineCard({
  title,
  data,
  lines,
}: {
  title: string;
  data: any[];
  lines: { key: string; color: string }[];
}) {
  return (
    <NeonSurface className="h-full">
      <div className="mb-2 text-sm text-slate-300/80">{title}</div>
      <div className="h-[220px]">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ left: 8, right: 16, bottom: 8 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="label" tick={{ fill: "#cbd5e1", fontSize: 11 }} />
            <YAxis tick={{ fill: "#cbd5e1", fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)" }} />
            <Legend />
            {lines.map((l) => (
              <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color} strokeWidth={2.4} dot={{ strokeWidth: 0 }} activeDot={{ r: 5 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </NeonSurface>
  );
}
