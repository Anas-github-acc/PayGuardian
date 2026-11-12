"use client";

import * as React from "react";
import CodeMirror from "@uiw/react-codemirror";
import { oneDark } from "@codemirror/theme-one-dark";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { json } from "@codemirror/lang-json";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { markdown } from "@codemirror/lang-markdown";
import { Check, Copy, Play, Undo2 } from "lucide-react";

interface CodeMirrorEditorProps {
  initialCode: string;
  language?: string;
  readOnly?: boolean;
  className?: string;
  onCodeChange?: (code: string) => void;
  onRun?: (code: string) => void;
}

export function CodeMirrorEditor({
  initialCode,
  language = "typescript",
  readOnly = false,
  className = "",
  onCodeChange,
  onRun,
}: CodeMirrorEditorProps) {
  const [code, setCode] = React.useState(initialCode);
  const [copied, setCopied] = React.useState(false);

  const getLanguageExtension = (lang: string) => {
    const l = lang.toLowerCase();
    if (l === "javascript" || l === "js") return javascript({ jsx: true });
    if (l === "typescript" || l === "ts" || l === "tsx")
      return javascript({ typescript: true, jsx: true });
    if (l === "python" || l === "py") return python();
    if (l === "json") return json();
    if (l === "html") return html();
    if (l === "css") return css();
    if (l === "markdown" || l === "md") return markdown();
    return [];
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setCode(initialCode);
    onCodeChange?.(initialCode);
  };

  return (
    <div
      className={`overflow-hidden rounded-xl border border-zinc-800 bg-[#1e1e1e] shadow-lg ${className}`}
    >
      {/* Editor Header */}
      <div className="flex h-10 items-center justify-between border-b border-zinc-800/80 bg-zinc-900/90 px-3.5 text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500/80" />
          <span className="font-mono uppercase tracking-wider text-zinc-300">{language}</span>
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
            CodeMirror 6
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {code !== initialCode && (
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
              title="Reset code"
            >
              <Undo2 className="h-3 w-3" />
              Reset
            </button>
          )}
          {onRun && (
            <button
              type="button"
              onClick={() => onRun(code)}
              className="flex items-center gap-1 rounded-md bg-blue-600/20 px-2 py-1 text-[11px] font-medium text-blue-400 transition-colors hover:bg-blue-600/30 hover:text-blue-300"
            >
              <Play className="h-3 w-3" />
              Run
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
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

      {/* CodeMirror Surface */}
      <div className="text-sm">
        <CodeMirror
          value={code}
          height="auto"
          minHeight="120px"
          maxHeight="520px"
          theme={oneDark}
          extensions={[getLanguageExtension(language)]}
          readOnly={readOnly}
          onChange={(val) => {
            setCode(val);
            onCodeChange?.(val);
          }}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            highlightSpecialChars: true,
            history: true,
            foldGutter: true,
            drawSelection: true,
            dropCursor: true,
            allowMultipleSelections: true,
            indentOnInput: true,
            syntaxHighlighting: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            rectangularSelection: true,
            crosshairCursor: true,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            closeBracketsKeymap: true,
            defaultKeymap: true,
            searchKeymap: true,
            historyKeymap: true,
            foldKeymap: true,
            completionKeymap: true,
            lintKeymap: true,
          }}
        />
      </div>
    </div>
  );
}
