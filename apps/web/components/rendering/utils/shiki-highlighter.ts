import { createHighlighter, type Highlighter } from "shiki";

let highlighterPromise: Promise<Highlighter> | null = null;

const SUPPORTED_LANGUAGES = [
  "javascript",
  "typescript",
  "python",
  "json",
  "bash",
  "sh",
  "sql",
  "html",
  "css",
  "markdown",
  "yaml",
  "rust",
  "go",
  "c",
  "cpp",
  "csharp",
  "java",
  "diff",
  "text",
];

const THEMES = ["github-dark", "github-light", "vitesse-dark", "nord"];

export function getShikiHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: THEMES,
      langs: SUPPORTED_LANGUAGES,
    }).catch((err) => {
      console.warn("Failed to initialize Shiki highlighter:", err);
      throw err;
    });
  }
  return highlighterPromise;
}
