"use client";

import * as React from "react";
import { KeyRound, PlusCircle, RotateCcw, Copy, Check, ShieldAlert } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { DEFAULT_API_KEYS, type ApiKey } from "./types";

export interface KeyManagerProps {
  className?: string;
}

export function KeyManager({ className = "" }: KeyManagerProps) {
  const [keys, setKeys] = React.useState<ApiKey[]>(DEFAULT_API_KEYS);
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [newKeyName, setNewKeyName] = React.useState("");
  const [newKeyEnv, setNewKeyEnv] = React.useState<"sandbox" | "production">("sandbox");
  const [newKeyScopes, setNewKeyScopes] = React.useState<string[]>([
    "payments:create",
    "mandates:read",
    "traces:read",
  ]);

  // Revealed new key modal state
  const [revealedKeySecret, setRevealedKeySecret] = React.useState<string | null>(null);
  const [copiedKey, setCopiedKey] = React.useState(false);
  const [copiedKeyId, setCopiedKeyId] = React.useState<string | null>(null);

  const availableScopes = [
    { id: "payments:create", label: "payments:create (Disburse autonomous payments)" },
    { id: "mandates:read", label: "mandates:read (Query authority balance and holds)" },
    { id: "mandates:delegate", label: "mandates:delegate (Delegate child sub-mandates)" },
    { id: "traces:read", label: "traces:read (Inspect audit events and trace records)" },
  ];

  const toggleScope = (scopeId: string) => {
    setNewKeyScopes((prev) =>
      prev.includes(scopeId) ? prev.filter((s) => s !== scopeId) : [...prev, scopeId],
    );
  };

  const handleCreateKey = () => {
    if (!newKeyName.trim()) return;

    const prefix = newKeyEnv === "production" ? "pg_live_" : "pg_test_";
    const randomHex =
      Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10);
    const fullSecret = `${prefix}${randomHex}`;

    const newKey: ApiKey = {
      id: `key-${Date.now()}`,
      name: newKeyName.trim(),
      keyPrefix: fullSecret.slice(0, 12),
      secretMasked: `${fullSecret.slice(0, 12)}••••••••••••••••••••${fullSecret.slice(-4)}`,
      environment: newKeyEnv,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      scopes: newKeyScopes,
      status: "active",
    };

    setKeys((prev) => [newKey, ...prev]);
    setIsCreateOpen(false);
    setNewKeyName("");
    setRevealedKeySecret(fullSecret);
  };

  const handleRotateKey = (keyId: string) => {
    const key = keys.find((k) => k.id === keyId);
    if (!key) return;

    const prefix = key.environment === "production" ? "pg_live_" : "pg_test_";
    const randomHex =
      Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10);
    const fullSecret = `${prefix}${randomHex}`;

    setKeys((prev) =>
      prev.map((k) =>
        k.id === keyId
          ? {
              ...k,
              keyPrefix: fullSecret.slice(0, 12),
              secretMasked: `${fullSecret.slice(0, 12)}••••••••••••••••••••${fullSecret.slice(-4)}`,
              createdAt: new Date().toISOString(),
            }
          : k,
      ),
    );

    setRevealedKeySecret(fullSecret);
  };

  const handleRevokeKey = (keyId: string) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("Revoke this API Key? Any agents using it will immediately be denied.")
    ) {
      return;
    }
    setKeys((prev) => prev.map((k) => (k.id === keyId ? { ...k, status: "revoked" as const } : k)));
  };

  const handleCopyMasked = (key: ApiKey) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(key.secretMasked);
      setCopiedKeyId(key.id);
      setTimeout(() => setCopiedKeyId((prev) => (prev === key.id ? null : prev)), 2000);
    }
  };

  const handleCopySecret = () => {
    if (revealedKeySecret && typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(revealedKeySecret);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-chart-1" />
            Agent API keys
          </CardTitle>
          <CardDescription>
            Bearer tokens that authenticate specialist agents to the PayGuardian gateway.
          </CardDescription>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsCreateOpen(true)}
          className="h-8 shrink-0 text-xs"
        >
          <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
          Create key
        </Button>
      </CardHeader>

      <CardContent className="p-0">
        {keys.length === 0 ? (
          <p className="px-5 py-10 text-center text-xs text-muted-foreground">
            No API keys yet. Create one to connect an agent.
          </p>
        ) : (
          <ul role="list" className="divide-y divide-border">
            {keys.map((key) => {
              const isRevoked = key.status === "revoked";
              const justCopied = copiedKeyId === key.id;

              return (
                <li
                  key={key.id}
                  className={cn(
                    "flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5",
                    isRevoked && "opacity-60",
                  )}
                >
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-semibold text-foreground">{key.name}</span>
                      <Badge
                        variant="default"
                        className={cn(
                          "font-mono text-[9px] uppercase tracking-wider",
                          key.environment === "production"
                            ? "bg-chart-2/10 text-chart-2 border-chart-2/30"
                            : "bg-warning/10 text-warning border-warning/30",
                        )}
                      >
                        {key.environment}
                      </Badge>
                      {isRevoked && (
                        <Badge variant="revoked" className="text-[10px]">
                          revoked
                        </Badge>
                      )}
                    </div>

                    <code className="block font-mono text-[11px] text-foreground">
                      {key.secretMasked}
                    </code>

                    <p className="text-[11px] text-muted-foreground">
                      Created {new Date(key.createdAt).toLocaleDateString()} · Last used{" "}
                      {key.lastUsedAt
                        ? new Date(key.lastUsedAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "never"}{" "}
                      · <span className="font-mono">{key.id}</span>
                    </p>

                    {key.scopes.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {key.scopes.map((scope) => (
                          <span
                            key={scope}
                            className="rounded border border-border bg-muted px-1.5 py-[0.05rem] font-mono text-[9px] text-muted-foreground"
                          >
                            {scope}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5 sm:self-center">
                    {isRevoked ? (
                      <span className="font-mono text-[10px] text-muted-foreground">Revoked</span>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyMasked(key)}
                          title="Copy key value"
                          className="h-7 px-2 text-xs"
                        >
                          {justCopied ? (
                            <Check className="h-3 w-3 text-success" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                          {justCopied ? "Copied" : "Copy"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRotateKey(key.id)}
                          title="Rotate key"
                          className="h-7 px-2 text-xs"
                        >
                          <RotateCcw className="mr-1 h-3 w-3" />
                          Rotate
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRevokeKey(key.id)}
                          title="Revoke key"
                          className="h-7 px-2.5 text-xs"
                        >
                          Revoke
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      {/* Create Key Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md bg-card border border-border p-6 text-foreground top-shade">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-chart-1" />
              Create agent API key
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Generates a new token authorizing specialist agents to call gateway methods.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4 text-xs">
            <div>
              <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground block mb-1.5">
                Key name / agent label
              </label>
              <Input
                placeholder="e.g. Travel Concierge Micro-Worker"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground block mb-1.5">
                Environment
              </span>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Key environment">
                <button
                  type="button"
                  onClick={() => setNewKeyEnv("sandbox")}
                  aria-pressed={newKeyEnv === "sandbox"}
                  className={`rounded-md p-2 text-xs font-medium border text-center transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                    newKeyEnv === "sandbox"
                      ? "border-warning/40 bg-warning/10 text-warning"
                      : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Sandbox (pg_test_)
                </button>
                <button
                  type="button"
                  onClick={() => setNewKeyEnv("production")}
                  aria-pressed={newKeyEnv === "production"}
                  className={`rounded-md p-2 text-xs font-medium border text-center transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                    newKeyEnv === "production"
                      ? "border-chart-2/40 bg-chart-2/10 text-chart-2"
                      : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Production (pg_live_)
                </button>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground block mb-1.5">
                Allowed scopes
              </span>
              <div className="space-y-1.5">
                {availableScopes.map((scope) => {
                  const isChecked = newKeyScopes.includes(scope.id);
                  return (
                    <label
                      key={scope.id}
                      className="flex items-center gap-2 rounded-md border border-border bg-secondary p-2 cursor-pointer hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleScope(scope.id)}
                        className="rounded border-border bg-background text-success focus:ring-0"
                      />
                      <span className="font-mono text-[11px] text-foreground">{scope.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6 flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateKey}
              disabled={!newKeyName.trim()}
              className="h-8 text-xs"
            >
              Generate key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Secret Revelation Dialog */}
      <Dialog open={Boolean(revealedKeySecret)} onOpenChange={() => setRevealedKeySecret(null)}>
        <DialogContent className="max-w-md bg-card border border-border p-6 text-foreground top-shade">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-warning" />
              Save your agent secret key
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Please copy and store this API secret now. It will never be displayed in full again.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-warning/30 bg-card p-3">
              <code className="font-mono text-xs text-warning break-all select-all">
                {revealedKeySecret}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopySecret}
                aria-label={copiedKey ? "Secret copied" : "Copy secret to clipboard"}
                className="ml-3 shrink-0 h-8 px-2.5 text-xs border-warning/30 text-warning hover:bg-warning/10"
              >
                {copiedKey ? (
                  <Check className="h-3.5 w-3.5 text-success" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>

            <div className="rounded-md border border-border bg-secondary p-2.5 text-[11px] text-muted-foreground">
              If compromised, immediately use the Rotate action to invalidate this credential and
              issue a new secret.
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              variant="secondary"
              onClick={() => setRevealedKeySecret(null)}
              className="w-full h-8 text-xs"
            >
              I have securely saved it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
