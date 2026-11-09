"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { BarChart3, Table, Copy, Check } from "lucide-react";
import type { ChartSpecification } from "../types";

const PALETTE = [
  "#0052FF", // PayGuardian primary blue
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#6366f1", // Indigo
];

interface RechartsRendererProps {
  spec?: ChartSpecification | string;
  code?: string;
  className?: string;
}

export function RechartsRenderer({ spec, code, className = "" }: RechartsRendererProps) {
  const [viewMode, setViewMode] = React.useState<"chart" | "table">("chart");
  const [copied, setCopied] = React.useState(false);

  // Parse specification
  const parsedSpec: ChartSpecification | null = React.useMemo(() => {
    const raw = spec || code;
    if (!raw) return null;
    if (typeof raw === "object" && raw !== null) return raw as ChartSpecification;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, [spec, code]);

  if (!parsedSpec || !Array.isArray(parsedSpec.data) || parsedSpec.data.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs text-rose-400 font-mono">
        Invalid chart specification. Please provide valid JSON with "type" and "data".
      </div>
    );
  }

  const { type, title, description, data, xAxisKey = "name", series = [] } = parsedSpec;

  // Auto-detect series if none specified
  const effectiveSeries =
    series.length > 0
      ? series
      : Object.keys(data[0] || {})
          .filter((k) => k !== xAxisKey)
          .map((k, i) => ({
            dataKey: k,
            label: k,
            color: PALETTE[i % PALETTE.length],
            fill: PALETTE[i % PALETTE.length],
          }));

  const handleCopyJson = async () => {
    await navigator.clipboard.writeText(JSON.stringify(parsedSpec, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderChart = () => {
    switch (type) {
      case "bar":
        return (
          <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey={xAxisKey} stroke="#71717a" fontSize={11} tickLine={false} />
            <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#09090b",
                borderColor: "#27272a",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#e4e4e7",
              }}
            />
            <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
            {effectiveSeries.map((s, idx) => (
              <Bar
                key={s.dataKey}
                dataKey={s.dataKey}
                name={s.label || s.dataKey}
                fill={s.color || PALETTE[idx % PALETTE.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        );

      case "area":
        return (
          <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
            <defs>
              {effectiveSeries.map((s, idx) => {
                const color = s.color || PALETTE[idx % PALETTE.length];
                return (
                  <linearGradient key={s.dataKey} id={`grad-${s.dataKey}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.6} />
                    <stop offset="95%" stopColor={color} stopOpacity={0.05} />
                  </linearGradient>
                );
              })}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey={xAxisKey} stroke="#71717a" fontSize={11} tickLine={false} />
            <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#09090b",
                borderColor: "#27272a",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#e4e4e7",
              }}
            />
            <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
            {effectiveSeries.map((s, idx) => {
              const color = s.color || PALETTE[idx % PALETTE.length];
              return (
                <Area
                  key={s.dataKey}
                  type="monotone"
                  dataKey={s.dataKey}
                  name={s.label || s.dataKey}
                  stroke={color}
                  fillOpacity={1}
                  fill={`url(#grad-${s.dataKey})`}
                />
              );
            })}
          </AreaChart>
        );

      case "pie":
        return (
          <PieChart>
            <Tooltip
              contentStyle={{
                backgroundColor: "#09090b",
                borderColor: "#27272a",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#e4e4e7",
              }}
            />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            <Pie
              data={data}
              dataKey={effectiveSeries[0]?.dataKey || "value"}
              nameKey={xAxisKey}
              cx="50%"
              cy="50%"
              outerRadius={95}
              innerRadius={50}
              paddingAngle={4}
              label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
              ))}
            </Pie>
          </PieChart>
        );

      case "radar":
        return (
          <RadarChart outerRadius={90} data={data}>
            <PolarGrid stroke="#27272a" />
            <PolarAngleAxis dataKey={xAxisKey} stroke="#71717a" fontSize={11} />
            <PolarRadiusAxis stroke="#3f3f46" fontSize={10} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#09090b",
                borderColor: "#27272a",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#e4e4e7",
              }}
            />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            {effectiveSeries.map((s, idx) => {
              const color = s.color || PALETTE[idx % PALETTE.length];
              return (
                <Radar
                  key={s.dataKey}
                  name={s.label || s.dataKey}
                  dataKey={s.dataKey}
                  stroke={color}
                  fill={color}
                  fillOpacity={0.4}
                />
              );
            })}
          </RadarChart>
        );

      case "line":
      default:
        return (
          <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey={xAxisKey} stroke="#71717a" fontSize={11} tickLine={false} />
            <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#09090b",
                borderColor: "#27272a",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#e4e4e7",
              }}
            />
            <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
            {effectiveSeries.map((s, idx) => (
              <Line
                key={s.dataKey}
                type="monotone"
                dataKey={s.dataKey}
                name={s.label || s.dataKey}
                stroke={s.color || PALETTE[idx % PALETTE.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        );
    }
  };

  return (
    <div className={`my-4 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-xl ${className}`}>
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-4 py-2.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-blue-500" />
            <h4 className="text-xs font-semibold text-zinc-100">{title || `${type.toUpperCase()} CHART`}</h4>
          </div>
          {description && <p className="mt-0.5 text-[11px] text-zinc-400">{description}</p>}
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("chart")}
              className={`flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                viewMode === "chart" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <BarChart3 className="h-3 w-3" />
              Chart
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                viewMode === "table" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Table className="h-3 w-3" />
              Data
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopyJson}
            className="flex items-center gap-1 rounded bg-zinc-800/80 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-700 hover:text-white"
            title="Copy chart data"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Chart Body */}
      <div className="p-4">
        {viewMode === "chart" ? (
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {renderChart()}
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="max-h-[280px] overflow-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="border-b border-zinc-800 bg-zinc-900 text-zinc-400">
                <tr>
                  <th className="p-2">{xAxisKey}</th>
                  {effectiveSeries.map((s) => (
                    <th key={s.dataKey} className="p-2">
                      {s.label || s.dataKey}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                {data.map((row, i) => (
                  <tr key={i} className="hover:bg-zinc-900/50">
                    <td className="p-2 font-medium text-white">{String(row[xAxisKey] ?? "")}</td>
                    {effectiveSeries.map((s) => (
                      <td key={s.dataKey} className="p-2">
                        {String(row[s.dataKey] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
