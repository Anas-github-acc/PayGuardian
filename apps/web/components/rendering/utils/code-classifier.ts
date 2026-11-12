export type DetectedContentType =
  "mermaid" | "chart" | "plotly" | "pdf" | "tiptap" | "html" | "code";

export function classifyCodeBlock(language: string, rawCode: string): DetectedContentType {
  const lang = (language || "").toLowerCase().trim();

  // Mermaid diagrams
  if (lang === "mermaid") {
    return "mermaid";
  }

  // Charts
  if (lang === "chart" || lang === "charts" || lang === "recharts" || lang === "json:chart") {
    return "chart";
  }

  // Plotly scientific visualizations
  if (lang === "plotly" || lang === "plotly.js" || lang === "json:plotly") {
    return "plotly";
  }

  // PDF Viewer
  if (lang === "pdf" || lang === "application/pdf" || lang === "json:pdf") {
    return "pdf";
  }

  // Document Editor
  if (lang === "tiptap" || lang === "document" || lang === "richtext" || lang === "doc") {
    return "tiptap";
  }

  // Raw HTML
  if (
    lang === "html" &&
    (rawCode.includes("<div") ||
      rawCode.includes("<svg") ||
      rawCode.includes("<table") ||
      rawCode.includes("<iframe"))
  ) {
    // If it's explicitly marked as html and looks like interactive markup, allow sanitized render
    if (rawCode.startsWith("<!-- render:html -->") || rawCode.startsWith("<!-- html -->")) {
      return "html";
    }
  }

  // Auto-detect JSON payloads that represent charts
  if (lang === "json") {
    const trimmed = rawCode.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (
          parsed.type &&
          ["line", "bar", "area", "pie", "radar", "scatter"].includes(parsed.type) &&
          Array.isArray(parsed.data)
        ) {
          return "chart";
        }
        if (
          parsed.data &&
          Array.isArray(parsed.data) &&
          (parsed.layout || parsed.config || parsed.data[0]?.type)
        ) {
          return "plotly";
        }
        if (parsed.pdfUrl || (parsed.url && parsed.url.endsWith(".pdf"))) {
          return "pdf";
        }
      } catch {
        // Not JSON
      }
    }
  }

  return "code";
}
