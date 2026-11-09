"use client";

import React, { useEffect, useRef, useState } from "react";
import { Activity, Code, Eye, Maximize2, Minimize2, RotateCcw } from "lucide-react";
import type { PlotlySpecification } from "../types";

interface PlotlyRendererProps {
  code: string;
  className?: string;
  title?: string;
}

export function PlotlyRenderer({ code, className = "", title }: PlotlyRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const plotlyInstanceRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<"plot" | "json">("plot");
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function renderPlot() {
      if (!containerRef.current || viewMode !== "plot") return;

      try {
        setLoading(true);
        setError(null);

        // Dynamically import Plotly on the client side only
        const Plotly = (await import("plotly.js-dist-min")).default;
        plotlyInstanceRef.current = Plotly;

        if (!isMounted || !containerRef.current) return;

        let spec: PlotlySpecification;
        const trimmed = code.trim();
        const parsed = JSON.parse(trimmed);

        if (Array.isArray(parsed)) {
          spec = { data: parsed, layout: {} };
        } else if (parsed && typeof parsed === "object") {
          spec = {
            data: parsed.data || [],
            layout: parsed.layout || {},
            config: parsed.config || {},
          };
        } else {
          throw new Error("Invalid Plotly specification format");
        }

        const darkLayout = {
          autosize: true,
          paper_bgcolor: "#09090b", // zinc-950
          plot_bgcolor: "#09090b",
          font: {
            family: "ui-sans-serif, system-ui, sans-serif",
            color: "#e4e4e7", // zinc-200
            size: 12,
          },
          margin: { l: 40, r: 40, t: spec.layout?.title ? 50 : 30, b: 40 },
          xaxis: {
            gridcolor: "#27272a", // zinc-800
            zerolinecolor: "#3f3f46", // zinc-700
            ...spec.layout?.xaxis,
          },
          yaxis: {
            gridcolor: "#27272a",
            zerolinecolor: "#3f3f46",
            ...spec.layout?.yaxis,
          },
          ...spec.layout,
        };

        const config: any = {
          responsive: true,
          displayModeBar: true,
          displaylogo: false,
          modeBarButtonsToRemove: ["lasso2d", "select2d"],
          ...spec.config,
        };

        await Plotly.newPlot(containerRef.current, spec.data, darkLayout, config);
        setLoading(false);
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || "Failed to render Plotly chart");
          setLoading(false);
        }
      }
    }

    renderPlot();

    const handleResize = () => {
      if (plotlyInstanceRef.current && containerRef.current) {
        plotlyInstanceRef.current.Plots.resize(containerRef.current);
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      isMounted = false;
      window.removeEventListener("resize", handleResize);
      if (plotlyInstanceRef.current && containerRef.current) {
        try {
          plotlyInstanceRef.current.purge(containerRef.current);
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, [code, viewMode]);

  const handleReset = () => {
    if (plotlyInstanceRef.current && containerRef.current) {
      plotlyInstanceRef.current.relayout(containerRef.current, {
        "xaxis.autorange": true,
        "yaxis.autorange": true,
      });
    }
  };

  return (
    <div
      className={`relative my-4 rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-lg transition-all ${
        isFullscreen ? "fixed inset-4 z-50 shadow-2xl flex flex-col" : ""
      } ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/60 px-4 py-2.5 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-semibold text-zinc-200">
            {title || "Scientific Visualization"}
          </span>
          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-mono text-emerald-400 border border-emerald-500/20">
            Plotly.js
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex rounded-md bg-zinc-800/60 p-0.5 border border-zinc-700/50">
            <button
              onClick={() => setViewMode("plot")}
              className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
                viewMode === "plot"
                  ? "bg-zinc-700 text-white font-medium shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Eye className="h-3 w-3" />
              Plot
            </button>
            <button
              onClick={() => setViewMode("json")}
              className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
                viewMode === "json"
                  ? "bg-zinc-700 text-white font-medium shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Code className="h-3 w-3" />
              JSON
            </button>
          </div>

          {viewMode === "plot" && (
            <button
              onClick={handleReset}
              className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
              title="Reset View"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className={`p-2 ${isFullscreen ? "flex-1 overflow-auto" : ""}`}>
        {viewMode === "plot" ? (
          <div className="relative w-full min-h-[380px] flex items-center justify-center">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/70 z-10 backdrop-blur-[1px]">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <div className="h-3.5 w-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  Rendering plot...
                </div>
              </div>
            )}
            {error ? (
              <div className="p-4 text-center">
                <p className="text-xs font-semibold text-rose-400 mb-1">
                  Plotly Rendering Error
                </p>
                <p className="text-[11px] text-zinc-500 font-mono max-w-md">
                  {error}
                </p>
                <pre className="mt-3 max-h-36 overflow-auto rounded bg-zinc-900 p-2 text-left text-[10px] text-zinc-400 font-mono">
                  {code}
                </pre>
              </div>
            ) : (
              <div
                ref={containerRef}
                className="w-full h-full min-h-[380px]"
                style={{ width: "100%", height: isFullscreen ? "100%" : "380px" }}
              />
            )}
          </div>
        ) : (
          <div className="p-2">
            <pre className="max-h-[380px] overflow-auto rounded-lg bg-zinc-900/90 p-3 font-mono text-xs text-zinc-300 border border-zinc-800">
              {code}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
