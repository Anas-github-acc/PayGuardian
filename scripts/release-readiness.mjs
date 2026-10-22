#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const strict = args.includes("--strict");
const results = [];

function option(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function pass(check, detail) {
  results.push({ state: "PASS", check, detail });
}

function warn(check, detail) {
  results.push({ state: "WARN", check, detail });
}

function fail(check, detail) {
  results.push({ state: "FAIL", check, detail });
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    encoding: "utf8",
    env: process.env,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error,
  };
}

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

const migrationIdPattern = /\b\d{14}_[a-z0-9_]+\b/g;
const migrationVersionPattern = /\b\d{14}\b/g;

function migrationVersion(value) {
  return (
    value.match(migrationIdPattern)?.[0].slice(0, 14) ?? value.match(migrationVersionPattern)?.[0]
  );
}

function tableCells(line) {
  if (line.includes("│")) return line.split("│");
  if (line.includes("|")) return line.split("|");
  return undefined;
}

function addMigrationVersions(target, value) {
  for (const match of value.matchAll(migrationIdPattern)) target.add(match[0].slice(0, 14));
  for (const match of value.matchAll(migrationVersionPattern)) target.add(match[0]);
}

export function parseRemoteMigrationVersions(output) {
  const lines = output.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => /\bLOCAL\b/.test(line) && /\bREMOTE\b/.test(line));

  if (headerIndex >= 0) {
    const header = tableCells(lines[headerIndex]);
    const remoteIndex = header?.findIndex((cell) => /\bREMOTE\b/.test(cell));
    if (remoteIndex !== undefined && remoteIndex >= 0) {
      const remoteVersions = new Set();
      for (const line of lines.slice(headerIndex + 1)) {
        const cells = tableCells(line);
        if (cells && cells.length > remoteIndex)
          addMigrationVersions(remoteVersions, cells[remoteIndex]);
      }
      return remoteVersions;
    }
  }

  try {
    const parsed = JSON.parse(output);
    const remoteVersions = new Set();

    function visit(value, context = "unknown") {
      if (Array.isArray(value)) {
        value.forEach((item) => visit(item, context));
        return;
      }
      if (value && typeof value === "object") {
        for (const [key, nested] of Object.entries(value)) {
          const normalizedKey = key.toLowerCase();
          const nestedContext = /remote|applied|target/.test(normalizedKey)
            ? "remote"
            : /local/.test(normalizedKey)
              ? "local"
              : context;
          visit(nested, nestedContext);
        }
        return;
      }
      if (context !== "local" && typeof value === "string")
        addMigrationVersions(remoteVersions, value);
    }

    visit(parsed);
    if (remoteVersions.size > 0) return remoteVersions;
  } catch {
    // The CLI's normal table output is handled below when JSON is unavailable.
  }

  const fallbackVersions = new Set();
  addMigrationVersions(fallbackVersions, output);
  return fallbackVersions;
}

export function validateHealthResponse(status, body, expectedService) {
  if (
    status !== 200 ||
    !body ||
    typeof body !== "object" ||
    body.status !== "ok" ||
    body.service !== expectedService
  ) {
    return {
      ok: false,
      detail: `unexpected response status=${status} service=${body?.service ?? "missing"}`,
    };
  }
  return { ok: true };
}

function checkRepositoryInputs() {
  const requiredFiles = [
    "package.json",
    "pnpm-lock.yaml",
    "uv.lock",
    ".env.example",
    "supabase/config.toml",
    "supabase/migrations",
  ];
  const missing = requiredFiles.filter((path) => !existsSync(join(root, path)));
  if (missing.length > 0) {
    fail("repository inputs", `missing ${missing.join(", ")}`);
    return;
  }

  const envLines = read(".env.example").split(/\r?\n/);
  const envNames = new Set(
    envLines.map((line) => line.match(/^([A-Z][A-Z0-9_]*)=/)?.[1]).filter(Boolean),
  );
  const requiredEnvNames = [
    "NODE_ENV",
    "DATABASE_MODE",
    "ENABLE_LOCAL_DEV_AUTH",
    "SUPABASE_SERVICE_ROLE_KEY",
    "PAYPAL_CLIENT_SECRET",
    "PAYPAL_WEBHOOK_ID",
  ];
  const missingEnvNames = requiredEnvNames.filter((name) => !envNames.has(name));
  if (missingEnvNames.length > 0) {
    fail("environment template", `missing names ${missingEnvNames.join(", ")}`);
  } else {
    pass("environment template", "required production-sensitive names are documented");
  }

  const suspiciousSecret =
    /(-----BEGIN|sk_(?:live|test)_|ghp_|xox[baprs]-|eyJ[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,})/;
  const leaked = envLines.filter((line) => suspiciousSecret.test(line));
  if (leaked.length > 0) {
    fail("environment template", "known credential-shaped value found in .env.example");
  } else {
    pass("environment template", "no known credential-shaped values found");
  }
}

function checkProductionConfig() {
  const result = run("pnpm", ["--filter", "@payguardian/config", "test", "--", "--run"]);
  if (result.status !== 0) {
    fail("production configuration", "@payguardian/config tests failed");
    return;
  }
  pass("production configuration", "production-mode configuration tests passed");
}

function checkAuditIntegrity() {
  const auditPath = "supabase/migrations/20261022008000_phase7_audit_integrity.sql";
  const basePath = "supabase/migrations/20261021002000_phase3_ledger_audit.sql";
  const auditSql = read(auditPath);
  const baseSql = read(basePath);
  const requiredAuditText = [
    "audit_events_actor_type_check",
    "audit_events_outcome_check",
    "audit_events_hash_format_check",
    "before update or delete on public.audit_events",
    "revoke insert, update, delete, truncate on public.audit_events",
    "create or replace function public.append_audit_event",
    "security definer",
    "set search_path = public",
    "digest(",
    "previousHash",
    "revoke all on function public.append_audit_event",
    "grant execute on function public.append_audit_event",
  ];
  const missing = requiredAuditText.filter((text) => !auditSql.includes(text));
  if (missing.length > 0) {
    fail("audit integrity", `migration is missing ${missing.join(", ")}`);
    return;
  }
  if (!baseSql.includes("alter table public.audit_events enable row level security")) {
    fail("audit integrity", "base audit table migration does not enable RLS");
    return;
  }
  pass("audit integrity", "RLS, hash-chain append path, mutation trigger, and grants are present");
}

function migrationIds() {
  const directory = join(root, "supabase/migrations");
  const files = readdirSync(directory)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const ids = files.map((file) => file.slice(0, -4));
  const invalid = ids.filter((id) => !/^\d{14}_[a-z0-9_]+$/.test(id));
  const versions = ids.map((id) => migrationVersion(id)).filter(Boolean);
  const duplicates = versions.filter((version, index) => versions.indexOf(version) !== index);
  return { files, ids, versions, invalid, duplicates };
}

function checkMigrationSource() {
  const { files, ids, invalid, duplicates } = migrationIds();
  if (files.length === 0) {
    fail("migration source", "no SQL migrations found");
    return;
  }
  if (invalid.length > 0 || duplicates.length > 0) {
    fail(
      "migration source",
      `invalid names: ${[...invalid, ...duplicates].join(", ") || "unknown"}`,
    );
    return;
  }
  const digest = createHash("sha256")
    .update(files.map((file) => `${file}\n${read(`supabase/migrations/${file}`)}`).join(""))
    .digest("hex");
  pass("migration source", `${files.length} ordered migrations; manifest sha256 ${digest}`);
}

function checkRemoteMigrationStatus() {
  const dbUrl = option("--db-url") ?? process.env.SUPABASE_MIGRATION_DB_URL;
  const linked = args.includes("--linked") || process.env.SUPABASE_MIGRATION_LINKED === "true";
  if (!dbUrl && !linked) {
    warn(
      "migration status",
      "not queried; provide --linked or SUPABASE_MIGRATION_DB_URL (use --strict to require it)",
    );
    return;
  }

  const commandArgs = ["supabase", "migration", "list"];
  if (dbUrl) commandArgs.push("--db-url", dbUrl);
  else commandArgs.push("--linked");
  const result = run("npx", commandArgs);
  if (result.status !== 0) {
    fail("migration status", "Supabase migration list failed; target status is unverified");
    return;
  }

  const output = result.stdout;
  const localIds = migrationIds().ids;
  const appliedVersions = parseRemoteMigrationVersions(output);
  if (appliedVersions.size === 0) {
    warn("migration status", "command succeeded but its output shape did not prove applied IDs");
    return;
  }
  const pending = localIds.filter((id) => !appliedVersions.has(migrationVersion(id)));
  if (pending.length > 0) {
    fail("migration status", `local migrations not shown as applied: ${pending.join(", ")}`);
    return;
  }
  pass(
    "migration status",
    `${localIds.length} repository migrations shown as applied by timestamp`,
  );
}

async function checkHealthEndpoint(name, url, expectedService) {
  let timeout;
  try {
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), 5_000);
    const response = await fetch(url, { signal: controller.signal });
    const body = await response.json();
    const validation = validateHealthResponse(response.status, body, expectedService);
    if (!validation.ok) {
      fail(name, validation.detail);
      return;
    }
    pass(name, `${url} returned status=ok`);
  } catch (error) {
    fail(name, error instanceof Error ? error.message : "health request failed");
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function checkHealthEndpoints() {
  const apiUrl = option("--api-url") ?? process.env.RELEASE_API_HEALTH_URL;
  const agentUrl = option("--agent-url") ?? process.env.RELEASE_AGENT_HEALTH_URL;
  if (!apiUrl) {
    warn("API health endpoint", "not queried; provide --api-url or RELEASE_API_HEALTH_URL");
  } else {
    await checkHealthEndpoint("API health endpoint", apiUrl, "gateway-api");
  }
  if (!agentUrl) {
    warn("agent health endpoint", "not queried; provide --agent-url or RELEASE_AGENT_HEALTH_URL");
  } else {
    await checkHealthEndpoint("agent health endpoint", agentUrl, "agent-runtime");
  }
}

export async function main() {
  checkRepositoryInputs();
  checkProductionConfig();
  checkAuditIntegrity();
  checkMigrationSource();
  checkRemoteMigrationStatus();
  await checkHealthEndpoints();

  for (const result of results) {
    console.log(`[${result.state}] ${result.check}: ${result.detail}`);
  }

  const failures = results.filter((result) => result.state === "FAIL").length;
  const warnings = results.filter((result) => result.state === "WARN").length;
  if (failures > 0 || (strict && warnings > 0)) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
