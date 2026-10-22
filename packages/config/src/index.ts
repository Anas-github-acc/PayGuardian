export type NodeEnvironment = "development" | "test" | "production";
export type DatabaseMode = "memory" | "supabase";
export type PayPalExecutionMode = "inline" | "worker";

export type RuntimeConfig = {
  nodeEnv: NodeEnvironment;
  databaseMode: DatabaseMode;
  localDevAuthEnabled: boolean;
  paypalExecutionMode: PayPalExecutionMode;
};

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

function parseNodeEnvironment(value: string | undefined): NodeEnvironment {
  if (value === undefined || value === "development") return "development";
  if (value === "production" || value === "test") return value;
  throw new ConfigurationError("NODE_ENV must be development, test, or production.");
}

function parseDatabaseMode(value: string | undefined): DatabaseMode {
  if (value === "supabase") return "supabase";
  if (value === undefined || value === "memory") return "memory";
  throw new ConfigurationError("DATABASE_MODE must be either memory or supabase.");
}

function parsePayPalExecutionMode(value: string | undefined): PayPalExecutionMode {
  if (value === "worker") return "worker";
  if (value === undefined || value === "inline") return "inline";
  throw new ConfigurationError("PAYPAL_EXECUTION_MODE must be either inline or worker.");
}

export function loadRuntimeConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): RuntimeConfig {
  const nodeEnv = parseNodeEnvironment(env.NODE_ENV);
  const databaseMode = parseDatabaseMode(env.DATABASE_MODE);
  const localDevAuthEnabled = env.ENABLE_LOCAL_DEV_AUTH === "true";
  const paypalExecutionMode = parsePayPalExecutionMode(env.PAYPAL_EXECUTION_MODE);

  if (nodeEnv === "production" && localDevAuthEnabled) {
    throw new ConfigurationError("ENABLE_LOCAL_DEV_AUTH must be false or unset in production.");
  }
  if (nodeEnv === "production" && databaseMode !== "supabase") {
    throw new ConfigurationError("DATABASE_MODE=supabase is required in production.");
  }
  if (nodeEnv === "production" && paypalExecutionMode !== "worker") {
    throw new ConfigurationError("PAYPAL_EXECUTION_MODE=worker is required in production.");
  }
  if (
    nodeEnv === "production" &&
    databaseMode === "supabase" &&
    (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)
  ) {
    throw new ConfigurationError(
      "DATABASE_MODE=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return {
    nodeEnv,
    databaseMode,
    localDevAuthEnabled,
    paypalExecutionMode,
  };
}

export const configurationPhase = "production-configuration-enforcement" as const;
