"use client";

import * as React from "react";
import { Copy, Check, Code2 } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";

export type CodeLanguage = "typescript" | "python" | "claude" | "cursor";

export interface CodeSnippetProps {
  endpointUrl?: string;
  apiKey?: string;
  className?: string;
}

const STRING_RE = /("(?:[^"\\]|\\.)*")/;

/** Theme-token syntax pass: comments muted, string literals chart-1, base foreground. */
function renderHighlighted(code: string): React.ReactNode[] {
  return code.split("\n").map((line, i) => {
    const trimmed = line.trimStart();
    const isComment = trimmed.startsWith("//") || trimmed.startsWith("#");

    if (isComment) {
      return (
        <div key={i} className="text-muted-foreground">
          {line || "\u00A0"}
        </div>
      );
    }

    return (
      <div key={i}>
        {line.split(STRING_RE).map((part, j) =>
          part.startsWith('"') ? (
            <span key={j} className="text-chart-1">
              {part}
            </span>
          ) : (
            <span key={j}>{part}</span>
          ),
        )}
      </div>
    );
  });
}

export function CodeSnippet({
  endpointUrl = "http://localhost:3001/v1/mcp",
  apiKey = "pg_test_4b2210ef3998a41",
  className = "",
}: CodeSnippetProps) {
  const [activeLang, setActiveLang] = React.useState<CodeLanguage>("typescript");
  const [copied, setCopied] = React.useState(false);

  const snippets: Record<CodeLanguage, { label: string; filename: string; code: string }> = {
    typescript: {
      label: "TypeScript SDK",
      filename: "agent.ts",
      code: `import { PayGuardianClient } from "@payguardian/sdk";

// Initialize the PayGuardian agent client
const client = new PayGuardianClient({
  endpoint: "${endpointUrl}",
  apiKey: process.env.PAYGUARDIAN_API_KEY ?? "${apiKey}",
  environment: "sandbox",
});

async function main() {
  // 1. Query current delegated authority limit (integer minor units)
  const balance = await client.mandate.getBalance();
  console.log(\`Available balance: $\${(balance.availableMinor / 100).toFixed(2)}\`);

  // 2. Execute an autonomous micro-payment via PayPal rail
  const payment = await client.payments.execute({
    recipient: "hotels.hyatt.com",
    amountMinor: 24500, // $245.00
    currency: "USD",
    merchantCategory: "Lodging & Accommodations",
    purpose: "Team lodging for dev conference",
  });

  if (payment.status === "completed") {
    console.log("Payment successful! Auth hash:", payment.authHash);
  } else if (payment.status === "pending_approval") {
    console.log("Exceeded autonomous threshold. Routed to Approvals Inbox:", payment.approvalId);
  }
}

main().catch(console.error);`,
    },
    python: {
      label: "Python ADK",
      filename: "agent.py",
      code: `import os
from payguardian_adk import PayGuardianClient, PaymentRequest

# Initialize the PayGuardian Agent Development Kit client
client = PayGuardianClient(
    endpoint="${endpointUrl}",
    api_key=os.getenv("PAYGUARDIAN_API_KEY", "${apiKey}"),
    environment="sandbox",
)

def run_specialist_task():
    # 1. Query active mandate authority
    mandate = client.get_active_mandate()
    print(f"Allocated limit: {mandate.allocated_minor} minor units ({mandate.currency})")

    # 2. Check policy compliance before payment execution
    is_allowed = client.check_policy(
        amount_minor=12500, # $125.00
        merchant="IndiGo Airlines Ltd",
        category="Airlines & Air Travel"
    )

    if is_allowed:
        # 3. Disburse payment via PayPal with cryptographic signature
        result = client.execute_payment(
            recipient="IndiGo Airlines Ltd",
            amount_minor=12500,
            currency="USD",
            idempotency_key="pay_req_981203"
        )
        print(f"Payment executed. Txn ID: {result.transaction_id}")
    else:
        print("Payment refused by gateway policy engine.")

if __name__ == "__main__":
    run_specialist_task()`,
    },
    claude: {
      label: "Claude Desktop",
      filename: "claude_desktop_config.json",
      code: `{
  "mcpServers": {
    "payguardian": {
      "command": "npx",
      "args": [
        "-y",
        "@payguardian/mcp-server",
        "--endpoint",
        "${endpointUrl}",
        "--api-key",
        "${apiKey}"
      ]
    }
  }
}`,
    },
    cursor: {
      label: "Cursor MCP",
      filename: ".cursor/mcp.json",
      code: `{
  "mcpServers": {
    "payguardian-gateway": {
      "url": "${endpointUrl}",
      "headers": {
        "Authorization": "Bearer ${apiKey}",
        "x-payguardian-env": "sandbox"
      }
    }
  }
}`,
    },
  };

  const currentSnippet = snippets[activeLang];

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(currentSnippet.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-chart-1" />
              Client snippets
            </CardTitle>
            <CardDescription>
              Ready-to-run connection scripts for SDKs and MCP-compatible IDEs.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
              {currentSnippet.filename}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              aria-label={copied ? "Code copied" : "Copy code to clipboard"}
              className="h-8 text-xs"
            >
              {copied ? (
                <>
                  <Check className="mr-1.5 h-3.5 w-3.5 text-success" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy code
                </>
              )}
            </Button>
          </div>
        </div>

        <Tabs value={activeLang} onValueChange={(v) => setActiveLang(v as CodeLanguage)}>
          <TabsList className="h-8 w-auto justify-start">
            {(Object.keys(snippets) as CodeLanguage[]).map((lang) => (
              <TabsTrigger key={lang} value={lang} className="h-6 px-2.5 text-[11px]">
                {snippets[lang].label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <pre className="overflow-x-auto rounded-md border border-border bg-background p-4 font-mono text-xs leading-relaxed text-foreground selection:bg-success/20">
          <code>{renderHighlighted(currentSnippet.code)}</code>
        </pre>
      </CardContent>
    </Card>
  );
}
