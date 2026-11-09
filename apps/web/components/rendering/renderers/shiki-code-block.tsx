"use client";

import * as React from "react";
import { Check, Copy, Download, Code2, Edit3, Terminal, ChevronDown, ChevronUp } from "lucide-react";
import { getShikiHighlighter } from "../utils/shiki-highlighter";
import { CodeMirrorEditor } from "./codemirror-editor";
import { MonacoIDE } from "./monaco-ide";
import type { CodeViewerMode } from "../types";

interface ShikiCodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  className?: string;
  defaultMode?: CodeViewerMode;
}

export function ShikiCodeBlock({
  code,
  language = "text",
  filename,
  className = "",
  defaultMode = "shiki",
}: ShikiCodeBlockProps) {
  const [mode, setMode] = React.useState<CodeViewerMode>(defaultMode);
  const [highlightedHtml, setHighlightedHtml] = React.useState<string>("");
  const [copied, setCopied] = React.useState(false);
  const [isExpanded, setIsExpanded] = React.useState(true);

  const linesCount = code.split("\n").length;
  const isLong = linesCount > 35;

  React.useEffect(() => {
    let cancelled = false;
    getShikiHighlighter()
      .then((highlighter) => {
        if (cancelled) return;
        const lang = language.toLowerCase();
        const validLang = highlighter.getLoadedLanguages().includes(lang) ? lang : "text";
        const html = highlighter.codeToHtml(code, {
          lang: validLang,
          theme: "github-dark",
        });
        setHighlightedHtml(html);
      })
      .catch(() => {
        // Fallback to plain text
      });

    return () => {
      cancelled = true;
    };
  }, [code, language]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || `snippet.${language || "txt"}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`group my-4 overflow-hidden rounded-xl border border-zinc-800 bg-[#0d1117] shadow-xl ${className}`}>
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-zinc-800 bg-zinc-900/90 px-3.5 py-2 text-xs text-zinc-400">
        {/* Left: Language & Filename */}
        <div className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-zinc-400" />
          {filename ? (
            <span className="font-mono font-medium text-zinc-200">{filename}</span>
          ) : (
            <span className="font-mono uppercase tracking-wider text-zinc-300">
              {language}
            </span>
          )}
          <span className="text-[10px] text-zinc-500 font-mono">
            {linesCount} {linesCount === 1 ? "line" : "lines"}
          </span>
        </div>

        {/* Right: Mode Switcher & Actions */}
        <div className="flex items-center gap-1.5">
          {/* Mode Tabs */}
          <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-950 p-0.5">
            <button
              type="button"
              onClick={() => setMode("shiki")}
              className={`flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                mode === "shiki"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Shiki Highlighted View"
            >
              <Code2 className="h-3 w-3" />
              <span>Shiki</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("codemirror")}
              className={`flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                mode === "codemirror"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Embedded CodeMirror 6 Editor"
            >
              <Edit3 className="h-3 w-3" />
              <span>Editor</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("monaco")}
              className={`flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                mode === "monaco"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Monaco Full IDE"
            >
              <Terminal className="h-3 w-3" />
              <span>IDE</span>
            </button>
          </div>

          {/* Download button */}
          <button
            type="button"
            onClick={handleDownload}
            className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-zinc-800 hover:text-white"
            title="Download file"
          >
            <Download className="h-3 w-3" />
          </button>

          {/* Copy button */}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 rounded bg-zinc-800/80 px-2 py-1 text-[11px] font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white"
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

          {/* Collapse/Expand for long code */}
          {isLong && mode === "shiki" && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-zinc-800 hover:text-white"
              title={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}
        </div>
      </div>

      {/* Body Content */}
      {mode === "codemirror" && (
        <div className="border-t border-zinc-800">
          <CodeMirrorEditor initialCode={code} language={language} />
        </div>
      )}

      {mode === "monaco" && (
        <div className="border-t border-zinc-800">
          <MonacoIDE initialCode={code} language={language} />
        </div>
      )}

      {mode === "shiki" && (
        <div
          className={`relative overflow-x-auto p-4 font-mono text-[13px] leading-relaxed transition-all ${
            isLong && !isExpanded ? "max-h-64 overflow-hidden" : ""
          }`}
        >
          {highlightedHtml ? (
            <div
              className="shiki-wrapper [&_pre]:!bg-transparent [&_pre]:!p-0 [&_code]:!font-mono"
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            />
          ) : (
            <pre className="text-zinc-300">
              <code>{code}</code>
            </pre>
          )}

          {isLong && !isExpanded && (
            <div className="absolute inset-x-0 bottom-0 flex h-24 items-end justify-center bg-gradient-to-t from-[#0d1117] to-transparent pb-3">
              <button
                type="button"
                onClick={() => setIsExpanded(true)}
                className="flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 shadow-lg hover:bg-zinc-800"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                Show all {linesCount} lines
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
