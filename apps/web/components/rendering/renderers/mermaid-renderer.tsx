"use client";

import * as React from "react";
import mermaid from "mermaid";
import { Check, Copy, Download, ZoomIn, ZoomOut, RotateCcw, Maximize2, AlertCircle } from "lucide-react";

interface MermaidRendererProps {
  chart: string;
  className?: string;
}

export function MermaidRenderer({ chart, className = "" }: MermaidRendererProps) {
  const [svg, setSvg] = React.useState<string>("");
  const [error, setError] = React.useState<string | null>(null);
  const [zoom, setZoom] = React.useState(1);
  const [copied, setCopied] = React.useState(false);
  const [copiedSvg, setCopiedSvg] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const idRef = React.useRef(`mermaid-${Math.random().toString(36).substring(2, 9)}`);

  React.useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: "dark",
      securityLevel: "loose",
      themeVariables: {
        darkMode: true,
        background: "#090d16",
        primaryColor: "#0052FF",
        primaryTextColor: "#ffffff",
        primaryBorderColor: "#3b82f6",
        lineColor: "#60a5fa",
        secondaryColor: "#1e293b",
        tertiaryColor: "#0f172a",
        fontSize: "13px",
        fontFamily: "var(--font-sans), system-ui, sans-serif",
      },
    });

    let isMounted = true;
    const cleanChart = chart.trim();

    mermaid
      .render(idRef.current, cleanChart)
      .then(({ svg: renderedSvg }) => {
        if (isMounted) {
          setSvg(renderedSvg);
          setError(null);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.warn("Mermaid syntax or render error:", err);
          setError(String(err.message || err));
        }
      });

    return () => {
      isMounted = false;
    };
  }, [chart]);

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(chart);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopySvg = async () => {
    if (!svg) return;
    await navigator.clipboard.writeText(svg);
    setCopiedSvg(true);
    setTimeout(() => setCopiedSvg(false), 2000);
  };

  const handleDownloadSvg = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diagram-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`my-4 overflow-hidden rounded-xl border border-zinc-800 bg-[#070b14] shadow-xl ${className}`}>
      {/* Diagram Header */}
      <div className="flex h-10 items-center justify-between border-b border-zinc-800 bg-zinc-900/90 px-3.5 text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-blue-500" />
          <span className="font-mono font-medium tracking-wider text-zinc-200">
            MERMAID DIAGRAM
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Zoom Controls */}
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))}
            className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-zinc-800 hover:text-white"
            title="Zoom out"
          >
            <ZoomOut className="h-3 w-3" />
          </button>
          <span className="px-1 font-mono text-[10px] text-zinc-500">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}
            className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-zinc-800 hover:text-white"
            title="Zoom in"
          >
            <ZoomIn className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-zinc-800 hover:text-white"
            title="Reset zoom"
          >
            <RotateCcw className="h-3 w-3" />
          </button>

          <div className="mx-1 h-3 w-px bg-zinc-800" />

          {/* Copy SVG */}
          <button
            type="button"
            onClick={handleCopySvg}
            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-white"
            title="Copy SVG"
          >
            {copiedSvg ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            <span>SVG</span>
          </button>

          {/* Download SVG */}
          <button
            type="button"
            onClick={handleDownloadSvg}
            className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-zinc-800 hover:text-white"
            title="Download SVG"
          >
            <Download className="h-3 w-3" />
          </button>

          {/* Copy Code */}
          <button
            type="button"
            onClick={handleCopyCode}
            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-white"
            title="Copy source code"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            <span>Code</span>
          </button>
        </div>
      </div>

      {/* Diagram Canvas */}
      <div
        ref={containerRef}
        className="relative flex min-h-[160px] items-center justify-center overflow-auto p-6"
      >
        {error ? (
          <div className="flex flex-col items-center gap-2 p-4 text-center text-xs text-rose-400">
            <AlertCircle className="h-5 w-5" />
            <span>Mermaid Render Error: {error}</span>
            <pre className="mt-2 max-w-full rounded bg-zinc-950 p-3 font-mono text-[11px] text-zinc-400 text-left overflow-x-auto">
              <code>{chart}</code>
            </pre>
          </div>
        ) : svg ? (
          <div
            style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
            className="transition-transform duration-100 flex items-center justify-center [&_svg]:max-w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            Rendering Mermaid diagram...
          </div>
        )}
      </div>
    </div>
  );
}
