"use client";

import * as React from "react";
import { BookOpen, ShieldCheck } from "lucide-react";
import { ConnectionTester } from "./ConnectionTester";
import { CodeSnippet } from "./CodeSnippet";
import { KeyManager } from "./KeyManager";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

export interface DeveloperPortalProps {
  className?: string;
}

const CONFIG_ROWS: { label: string; value: string }[] = [
  { label: "Protocol", value: "JSON-RPC 2.0 · MCP v1.4.0" },
  { label: "Authentication", value: "Bearer API key" },
  { label: "Key prefixes", value: "pg_test_ (sandbox) · pg_live_ (production)" },
  { label: "SDK clients", value: "TypeScript · Python ADK" },
];

export function DeveloperPortal({ className = "" }: DeveloperPortalProps) {
  const [endpointUrl, setEndpointUrl] = React.useState("http://localhost:3001/v1/mcp");

  return (
    <div className={`flex flex-col min-h-0 flex-1 bg-background text-foreground overflow-y-auto ${className}`}>
      <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">Developer</h1>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
              Connect external LLM agents (Claude Desktop, Cursor, LangChain, AutoGen) to PayGuardian
              via the Model Context Protocol, or integrate native REST/SDK clients.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.open("https://modelcontextprotocol.io", "_blank");
              }
            }}
            className="h-8 shrink-0 text-xs"
          >
            <BookOpen className="mr-1.5 h-3.5 w-3.5" />
            MCP Docs
          </Button>
        </div>

        {/* Connection tester */}
        <section aria-labelledby="connection-tester-heading" className="mt-6">
          <h2 id="connection-tester-heading" className="sr-only">
            MCP connection handshake
          </h2>
          <ConnectionTester
            initialEndpoint={endpointUrl}
            onEndpointChange={setEndpointUrl}
          />
        </section>

        {/* Integration code snippets */}
        <section aria-labelledby="code-snippets-heading" className="mt-6">
          <h2 id="code-snippets-heading" className="sr-only">
            Client setup and code snippets
          </h2>
          <CodeSnippet endpointUrl={endpointUrl} />
        </section>

        {/* API key credentials */}
        <section aria-labelledby="key-manager-heading" className="mt-6">
          <h2 id="key-manager-heading" className="sr-only">
            Agent API credentials
          </h2>
          <KeyManager />
        </section>

        {/* Gateway configuration + security model */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Gateway configuration</CardTitle>
              <CardDescription>
                Connection parameters exposed to your agents and IDEs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-border overflow-hidden rounded-md border border-border bg-muted/50 text-xs">
                <div className="flex items-center justify-between gap-4 px-3 py-2.5">
                  <dt className="shrink-0 text-muted-foreground">Gateway endpoint</dt>
                  <dd className="truncate font-mono text-[11px] font-medium text-foreground" title={endpointUrl}>
                    {endpointUrl}
                  </dd>
                </div>
                {CONFIG_ROWS.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-4 px-3 py-2.5">
                    <dt className="shrink-0 text-muted-foreground">{row.label}</dt>
                    <dd className="truncate font-mono text-[11px] font-medium text-foreground" title={row.value}>
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-success" />
                Gateway security model
              </CardTitle>
              <CardDescription>
                How the gateway authenticates calls and holds funds for review.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs leading-relaxed text-muted-foreground">
                All calls through the Model Context Protocol require bearer token authentication. Payment
                execution requests are evaluated against the calling agent&apos;s active mandate limits in
                real-time. If an action exceeds single-payment thresholds, the gateway halts execution and
                creates an item in the Human Approvals Inbox, returning an in-progress verification receipt
                without disbursing funds.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
