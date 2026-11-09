"use client";

import * as React from "react";
import DOMPurify from "dompurify";

interface HtmlSanitizerProps {
  html: string;
  className?: string;
  inline?: boolean;
}

export function HtmlSanitizer({ html, className = "", inline = false }: HtmlSanitizerProps) {
  const [sanitized, setSanitized] = React.useState<string>("");

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const clean = DOMPurify.sanitize(html, {
        USE_PROFILES: { html: true, svg: true },
        ADD_ATTR: ["target", "rel", "data-*"],
      });
      setSanitized(clean);
    }
  }, [html]);

  if (inline) {
    return (
      <span
        className={`safe-html-inline ${className}`}
        dangerouslySetInnerHTML={{ __html: sanitized || html }}
      />
    );
  }

  return (
    <div
      className={`safe-html-block rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 font-sans text-sm text-zinc-200 ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitized || html }}
    />
  );
}
