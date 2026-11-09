"use client";

import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { AIRendererOptions } from "./types";
import { classifyCodeBlock } from "./utils/code-classifier";
import { ShikiCodeBlock } from "./renderers/shiki-code-block";
import { MermaidRenderer } from "./renderers/mermaid-renderer";
import { RechartsRenderer } from "./renderers/recharts-renderer";
import { PlotlyRenderer } from "./renderers/plotly-renderer";
import { PdfViewer } from "./renderers/pdf-viewer";
import { TiptapEditor } from "./renderers/tiptap-editor";
import { HtmlSanitizer } from "./renderers/html-sanitizer";

export interface AIRendererProps {
  content: string;
  className?: string;
  options?: AIRendererOptions;
}

export function AIRenderer({
  content,
  className = "",
  options = {},
}: AIRendererProps) {
  const {
    enableMath = true,
    enableGfm = true,
    enableMermaid = true,
    enableCharts = true,
    enablePlotly = true,
    enablePdf = true,
    enableHtmlSanitization = true,
    enableDocumentEditor = true,
    defaultCodeViewerMode = "shiki",
  } = options;

  const remarkPlugins = useMemo(() => {
    const plugins: any[] = [];
    if (enableGfm) plugins.push(remarkGfm);
    if (enableMath) plugins.push(remarkMath);
    return plugins;
  }, [enableGfm, enableMath]);

  const rehypePlugins = useMemo(() => {
    const plugins: any[] = [];
    if (enableMath) plugins.push(rehypeKatex);
    return plugins;
  }, [enableMath]);

  return (
    <div
      className={`ai-renderer max-w-none text-zinc-200 text-base sm:text-[17px] leading-relaxed space-y-4 font-sans selection:bg-zinc-800 selection:text-white ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={{
          code({ node, className: codeClassName, children, ...props }) {
            const rawCode = String(children).replace(/\n$/, "");
            const match = /language-(\w+)/.exec(codeClassName || "");
            const language = match ? match[1] : "";
            const isInline = !codeClassName && !rawCode.includes("\n");

            if (isInline) {
              return (
                <code
                  className="rounded bg-zinc-800/80 px-1.5 py-0.5 font-mono text-[13px] text-zinc-200 border border-zinc-700/50"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            const detectedType = classifyCodeBlock(language, rawCode);

            // 1. Mermaid Diagrams
            if (detectedType === "mermaid" && enableMermaid) {
              return <MermaidRenderer chart={rawCode} />;
            }

            // 2. Recharts
            if (detectedType === "chart" && enableCharts) {
              return <RechartsRenderer code={rawCode} />;
            }

            // 3. Plotly.js Scientific Visualizations
            if (detectedType === "plotly" && enablePlotly) {
              return <PlotlyRenderer code={rawCode} />;
            }

            // 4. PDF Viewer (react-pdf)
            if (detectedType === "pdf" && enablePdf) {
              return <PdfViewer source={rawCode} />;
            }

            // 5. Tiptap Document Editor
            if (detectedType === "tiptap" && enableDocumentEditor) {
              return <TiptapEditor content={rawCode} />;
            }

            // 6. Sanitized Raw HTML
            if (detectedType === "html" && enableHtmlSanitization) {
              return <HtmlSanitizer html={rawCode} />;
            }

            // 7. Code Block (Shiki + CodeMirror 6 + Monaco Editor)
            return (
              <ShikiCodeBlock
                code={rawCode}
                language={language || "typescript"}
                defaultMode={defaultCodeViewerMode}
              />
            );
          },

          table({ children }) {
            return (
              <div className="my-4 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/70 shadow-sm">
                <table className="w-full text-left text-xs border-collapse">
                  {children}
                </table>
              </div>
            );
          },

          thead({ children }) {
            return (
              <thead className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-300 font-semibold uppercase tracking-wider text-[11px]">
                {children}
              </thead>
            );
          },

          tbody({ children }) {
            return (
              <tbody className="divide-y divide-zinc-800/60 font-mono text-zinc-300">
                {children}
              </tbody>
            );
          },

          tr({ children }) {
            return (
              <tr className="hover:bg-zinc-800/30 transition-colors">
                {children}
              </tr>
            );
          },

          th({ children }) {
            return <th className="px-3 py-2.5">{children}</th>;
          },

          td({ children }) {
            return <td className="px-3 py-2">{children}</td>;
          },

          blockquote({ children }) {
            return (
              <blockquote className="my-3 border-l-2 border-emerald-500/80 pl-4 py-1 text-zinc-300 italic bg-emerald-500/5 rounded-r-md">
                {children}
              </blockquote>
            );
          },

          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 underline decoration-emerald-500/40 underline-offset-2 hover:decoration-emerald-400 font-medium transition-colors"
              >
                {children}
              </a>
            );
          },

          ul({ children }) {
            return (
              <ul className="my-2 ml-5 list-disc space-y-1 text-zinc-300">
                {children}
              </ul>
            );
          },

          ol({ children }) {
            return (
              <ol className="my-2 ml-5 list-decimal space-y-1 text-zinc-300">
                {children}
              </ol>
            );
          },

          li({ children }) {
            return <li className="leading-relaxed">{children}</li>;
          },

          h1({ children }) {
            return (
              <h1 className="mt-5 mb-3 text-lg font-bold text-white tracking-tight border-b border-zinc-800 pb-1.5">
                {children}
              </h1>
            );
          },

          h2({ children }) {
            return (
              <h2 className="mt-4 mb-2 text-base font-semibold text-zinc-100 tracking-tight">
                {children}
              </h2>
            );
          },

          h3({ children }) {
            return (
              <h3 className="mt-3 mb-1.5 text-sm font-semibold text-zinc-200">
                {children}
              </h3>
            );
          },

          p({ children }) {
            return <p className="my-2 leading-relaxed text-zinc-300">{children}</p>;
          },

          hr() {
            return <hr className="my-4 border-zinc-800/80" />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
