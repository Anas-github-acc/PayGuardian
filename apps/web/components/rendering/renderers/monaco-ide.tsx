"use client";

import * as React from "react";
import Editor from "@monaco-editor/react";
import { Check, Copy, Eye, EyeOff, Maximize2, Minimize2, Settings2 } from "lucide-react";

interface MonacoIDEProps {
  initialCode: string;
  language?: string;
  readOnly?: boolean;
  className?: string;
  onCodeChange?: (code: string) => void;
}

export function MonacoIDE({
  initialCode,
  language = "typescript",
  readOnly = false,
  className = "",
  onCodeChange,
}: MonacoIDEProps) {
  const [code, setCode] = React.useState(initialCode);
  const [copied, setCopied] = React.useState(false);
  const [showMinimap, setShowMinimap] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [wordWrap, setWordWrap] = React.useState<"on" | "off">("on");

  const normalizeLang = (l: string): string => {
    const s = l.toLowerCase();
    if (s === "js" || s === "jsx") return "javascript";
    if (s === "ts" || s === "tsx") return "typescript";
    if (s === "py") return "python";
    if (s === "sh" || s === "bash") return "shell";
    if (s === "md") return "markdown";
    if (s === "yml") return "yaml";
    return s;
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`overflow-hidden rounded-xl border border-zinc-800 bg-[#1e1e1e] shadow-xl transition-all ${
        isFullscreen
          ? "fixed inset-4 z-50 flex flex-col bg-zinc-950/95 backdrop-blur-xl"
          : className
      }`}
    >
      {/* IDE Top Bar */}
      <div className="flex h-10 items-center justify-between border-b border-zinc-800 bg-zinc-900/90 px-3.5 text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-blue-500" />
          <span className="font-mono font-medium uppercase tracking-wider text-zinc-200">
            {language}
          </span>
          <span className="rounded bg-blue-950/60 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400 border border-blue-800/40">
            Monaco IDE
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Minimap toggle */}
          <button
            type="button"
            onClick={() => setShowMinimap(!showMinimap)}
            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-white"
            title="Toggle Minimap"
          >
            {showMinimap ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            <span className="hidden sm:inline">Minimap</span>
          </button>

          {/* Word wrap toggle */}
          <button
            type="button"
            onClick={() => setWordWrap(wordWrap === "on" ? "off" : "on")}
            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-white"
            title="Toggle Word Wrap"
          >
            <Settings2 className="h-3 w-3" />
            <span className="hidden sm:inline">Wrap: {wordWrap}</span>
          </button>

          {/* Fullscreen toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-white"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </button>

          {/* Copy button */}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-white"
            title="Copy code"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Editor Surface */}
      <div className={`relative ${isFullscreen ? "flex-1" : "h-[380px]"}`}>
        <Editor
          height="100%"
          language={normalizeLang(language)}
          value={code}
          theme="vs-dark"
          loading={
            <div className="flex h-full items-center justify-center text-xs text-zinc-500 font-mono">
              Loading Monaco IDE engine...
            </div>
          }
          onChange={(val) => {
            const next = val ?? "";
            setCode(next);
            onCodeChange?.(next);
          }}
          options={{
            readOnly,
            minimap: { enabled: showMinimap },
            wordWrap,
            fontSize: 13,
            lineNumbers: "on",
            roundedSelection: true,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            fontFamily: "var(--font-geist-mono), monospace",
            cursorBlinking: "smooth",
            smoothScrolling: true,
            contextmenu: true,
            padding: { top: 12, bottom: 12 },
          }}
        />
      </div>
    </div>
  );
}
