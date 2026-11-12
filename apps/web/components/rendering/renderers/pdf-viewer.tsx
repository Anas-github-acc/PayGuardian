"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Download,
  ExternalLink,
  RotateCcw,
} from "lucide-react";

interface PdfViewerProps {
  source: string; // URL, data URL, or JSON string with { url, title, base64 }
  title?: string;
  className?: string;
}

export function PdfViewer({ source, title, className = "" }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [pdfComponents, setPdfComponents] = useState<{
    Document: any;
    Page: any;
  } | null>(null);

  // Parse source if it's JSON
  let fileUrl = source;
  let displayTitle = title || "Document.pdf";

  try {
    const trimmed = source.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      const parsed = JSON.parse(trimmed);
      if (parsed.url) fileUrl = parsed.url;
      else if (parsed.pdfUrl) fileUrl = parsed.pdfUrl;
      else if (parsed.base64) fileUrl = `data:application/pdf;base64,${parsed.base64}`;
      if (parsed.title) displayTitle = parsed.title;
    }
  } catch {
    // Not JSON, use source directly
  }

  // Client-side dynamic import of react-pdf to prevent SSR document errors
  useEffect(() => {
    let isMounted = true;

    async function loadReactPdf() {
      try {
        const { Document, Page, pdfjs } = await import("react-pdf");

        // Configure worker to use official pdfjs CDN matching version
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

        if (isMounted) {
          setPdfComponents({ Document, Page });
        }
      } catch (err: any) {
        if (isMounted) {
          setError("Failed to initialize PDF renderer: " + (err?.message || "Unknown error"));
        }
      }
    }

    loadReactPdf();

    return () => {
      isMounted = false;
    };
  }, []);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPageNumber(1);
    setLoading(false);
  }

  function onDocumentLoadError(err: Error) {
    setError(err.message || "Failed to load PDF document");
    setLoading(false);
  }

  const changePage = (offset: number) => {
    setPageNumber((prev) => {
      const next = prev + offset;
      if (numPages) {
        return Math.min(Math.max(1, next), numPages);
      }
      return Math.max(1, next);
    });
  };

  return (
    <div
      className={`my-4 rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-lg ${className}`}
    >
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 bg-zinc-900/60 px-4 py-2.5 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-red-400" />
          <span className="text-xs font-semibold text-zinc-200 truncate max-w-[200px]">
            {displayTitle}
          </span>
          <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-mono text-red-400 border border-red-500/20">
            react-pdf
          </span>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2">
          {/* Page navigation */}
          {numPages && numPages > 1 && (
            <div className="flex items-center gap-1 rounded-md bg-zinc-800/60 p-0.5 border border-zinc-700/50 text-xs">
              <button
                onClick={() => changePage(-1)}
                disabled={pageNumber <= 1}
                className="rounded p-1 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
                title="Previous page"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="px-1 text-[11px] text-zinc-300 font-mono">
                {pageNumber} / {numPages}
              </span>
              <button
                onClick={() => changePage(1)}
                disabled={pageNumber >= numPages}
                className="rounded p-1 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
                title="Next page"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Zoom controls */}
          <div className="flex items-center gap-1 rounded-md bg-zinc-800/60 p-0.5 border border-zinc-700/50">
            <button
              onClick={() => setScale((s) => Math.max(0.5, s - 0.15))}
              className="rounded p-1 text-zinc-400 hover:text-white transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="px-1 text-[11px] text-zinc-300 font-mono">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale((s) => Math.min(2.5, s + 0.15))}
              className="rounded p-1 text-zinc-400 hover:text-white transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setScale(1.0)}
              className="rounded p-1 text-zinc-400 hover:text-white transition-colors"
              title="Reset Zoom"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          </div>

          {/* External / Download */}
          {fileUrl && (
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* PDF Viewport */}
      <div className="flex min-h-[300px] max-h-[650px] overflow-auto items-center justify-center bg-zinc-950 p-4">
        {error ? (
          <div className="p-6 text-center">
            <p className="text-xs font-semibold text-rose-400 mb-1">Unable to display PDF</p>
            <p className="text-[11px] text-zinc-500 max-w-sm mb-3">{error}</p>
            {fileUrl && (
              <a
                href={fileUrl}
                download
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Download PDF File
              </a>
            )}
          </div>
        ) : !pdfComponents ? (
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <div className="h-3.5 w-3.5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            Initializing PDF engine...
          </div>
        ) : (
          <pdfComponents.Document
            file={fileUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <div className="h-3.5 w-3.5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                Loading PDF document...
              </div>
            }
          >
            <pdfComponents.Page
              pageNumber={pageNumber}
              scale={scale}
              renderAnnotationLayer={false}
              renderTextLayer={false}
              className="shadow-2xl rounded-sm overflow-hidden border border-zinc-800"
            />
          </pdfComponents.Document>
        )}
      </div>
    </div>
  );
}
