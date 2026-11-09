export type CodeViewerMode = "shiki" | "codemirror" | "monaco";

export interface AIRendererOptions {
  enableMath?: boolean;
  enableGfm?: boolean;
  enableMermaid?: boolean;
  enableCharts?: boolean;
  enablePlotly?: boolean;
  enablePdf?: boolean;
  enableHtmlSanitization?: boolean;
  enableDocumentEditor?: boolean;
  defaultCodeViewerMode?: CodeViewerMode;
  theme?: "dark" | "light";
  className?: string;
}

export interface ChartSpecification {
  type: "line" | "bar" | "area" | "pie" | "radar" | "scatter";
  title?: string;
  description?: string;
  data: Array<Record<string, string | number>>;
  xAxisKey?: string;
  series: Array<{
    dataKey: string;
    label?: string;
    color?: string;
    fill?: string;
  }>;
}

export interface PlotlySpecification {
  data: any[];
  layout?: Record<string, any>;
  config?: Record<string, any>;
}

export interface PdfSpecification {
  url?: string;
  base64?: string;
  title?: string;
}
