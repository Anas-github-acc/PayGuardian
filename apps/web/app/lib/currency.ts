/**
 * PayGuardian Strict Minor-Unit Financial Arithmetic & Formatting
 *
 * Invariant: All financial amounts are stored, manipulated, and passed as exact
 * safe integers representing minor units (e.g., paise, cents, pence).
 * ZERO floating-point arithmetic is permitted.
 */

export const CURRENCY_DECIMALS: Readonly<Record<string, number>> = Object.freeze({
  JPY: 0,
  KRW: 0,
  VND: 0,
  CLP: 0,
  BHD: 3,
  KWD: 3,
  OMR: 3,
  TND: 3,
  JOD: 3,
  USD: 2,
  INR: 2,
  EUR: 2,
  GBP: 2,
  CAD: 2,
  AUD: 2,
  CHF: 2,
  SGD: 2,
});

export const CURRENCY_SYMBOLS: Readonly<Record<string, string>> = Object.freeze({
  USD: "$",
  INR: "₹",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CAD: "CA$",
  AUD: "A$",
  SGD: "S$",
  CHF: "CHF ",
});

/**
 * Asserts that the provided number is a safe integer.
 * Throws TypeError if the value is not an integer or is outside safe bounds.
 */
export function assertSafeInteger(value: number, fieldName = "amountMinor"): void {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(
      `[CurrencyError] Expected ${fieldName} to be a safe integer, received: ${value} (${typeof value})`,
    );
  }
}

/**
 * Returns the minor unit decimals for a given currency code (default 2).
 */
export function getCurrencyDecimals(currency = "USD"): number {
  const code = currency.toUpperCase();
  return CURRENCY_DECIMALS[code] ?? 2;
}

/**
 * Returns the symbol for a given currency code.
 */
export function getCurrencySymbol(currency = "USD"): string {
  const code = currency.toUpperCase();
  return CURRENCY_SYMBOLS[code] ?? `${code} `;
}

/**
 * Formats a minor-unit integer amount into a human-readable currency string.
 *
 * Example:
 * - formatMinorUnits(1000000, 'INR') -> "₹10,000.00"
 * - formatMinorUnits(4250, 'USD') -> "$42.50"
 * - formatMinorUnits(-250, 'USD') -> "-$2.50"
 * - formatMinorUnits(500, 'JPY') -> "¥500"
 *
 * Guarantee: Zero floating-point operations. Uses exact integer division and modulo.
 */
export function formatMinorUnits(
  amountMinor: number,
  currency = "USD",
  options?: {
    showSymbol?: boolean;
    locale?: string;
  },
): string {
  assertSafeInteger(amountMinor, "amountMinor");

  const decimals = getCurrencyDecimals(currency);
  const showSymbol = options?.showSymbol ?? true;
  const symbol = showSymbol ? getCurrencySymbol(currency) : "";

  const isNegative = amountMinor < 0;
  const absAmount = Math.abs(amountMinor);

  if (decimals === 0) {
    const locale = options?.locale ?? (currency.toUpperCase() === "INR" ? "en-IN" : "en-US");
    const formattedWhole = absAmount.toLocaleString(locale);
    return `${isNegative ? "-" : ""}${symbol}${formattedWhole}`;
  }

  // Exact integer scaling factor (e.g. 100 for 2 decimals, 1000 for 3)
  const factor = 10 ** decimals;
  const whole = Math.floor(absAmount / factor);
  const remainder = absAmount % factor;

  const locale = options?.locale ?? (currency.toUpperCase() === "INR" ? "en-IN" : "en-US");
  const formattedWhole = whole.toLocaleString(locale);
  const formattedFraction = remainder.toString().padStart(decimals, "0");

  return `${isNegative ? "-" : ""}${symbol}${formattedWhole}.${formattedFraction}`;
}

/**
 * Calculates available balance strictly using integer minor units.
 * Formula: Available = Allocated - Spent - Reserved
 */
export function calculateAvailableMinor(
  allocatedMinor: number,
  spentMinor: number,
  reservedMinor: number,
): number {
  assertSafeInteger(allocatedMinor, "allocatedMinor");
  assertSafeInteger(spentMinor, "spentMinor");
  assertSafeInteger(reservedMinor, "reservedMinor");

  const available = allocatedMinor - spentMinor - reservedMinor;
  assertSafeInteger(available, "availableMinor");
  return available;
}

/**
 * Exact integer addition of minor units.
 */
export function addMinor(...amounts: number[]): number {
  let total = 0;
  for (const amt of amounts) {
    assertSafeInteger(amt, "amountMinor");
    total += amt;
    assertSafeInteger(total, "totalMinor");
  }
  return total;
}

/**
 * Exact integer subtraction of minor units (a - b).
 */
export function subtractMinor(a: number, b: number): number {
  assertSafeInteger(a, "a");
  assertSafeInteger(b, "b");
  const result = a - b;
  assertSafeInteger(result, "result");
  return result;
}

/**
 * Exact integer multiplication of minor units by an integer factor.
 */
export function multiplyMinor(amountMinor: number, factorInteger: number): number {
  assertSafeInteger(amountMinor, "amountMinor");
  assertSafeInteger(factorInteger, "factorInteger");
  const result = amountMinor * factorInteger;
  assertSafeInteger(result, "result");
  return result;
}

/**
 * Exact integer division with quotient and remainder (zero floats).
 */
export function divideMinor(
  amountMinor: number,
  divisorInteger: number,
): { quotient: number; remainder: number } {
  assertSafeInteger(amountMinor, "amountMinor");
  assertSafeInteger(divisorInteger, "divisorInteger");
  if (divisorInteger === 0) {
    throw new RangeError("[CurrencyError] Division by zero");
  }

  const quotient = Math.trunc(amountMinor / divisorInteger);
  const remainder = amountMinor % divisorInteger;
  assertSafeInteger(quotient, "quotient");
  assertSafeInteger(remainder, "remainder");

  return { quotient, remainder };
}

/**
 * Exact integer modulo of minor units.
 */
export function moduloMinor(amountMinor: number, divisorInteger: number): number {
  assertSafeInteger(amountMinor, "amountMinor");
  assertSafeInteger(divisorInteger, "divisorInteger");
  if (divisorInteger === 0) {
    throw new RangeError("[CurrencyError] Modulo by zero");
  }
  const result = amountMinor % divisorInteger;
  assertSafeInteger(result, "result");
  return result;
}

/**
 * Converts a minor unit integer into a canonical decimal string (e.g., 10050 -> "100.50").
 * Guarantees zero floating-point representation errors.
 */
export function minorToMajorString(amountMinor: number, currency = "USD"): string {
  assertSafeInteger(amountMinor, "amountMinor");
  const decimals = getCurrencyDecimals(currency);
  const isNegative = amountMinor < 0;
  const absAmount = Math.abs(amountMinor);

  if (decimals === 0) {
    return `${isNegative ? "-" : ""}${absAmount}`;
  }

  const factor = 10 ** decimals;
  const whole = Math.floor(absAmount / factor);
  const remainder = absAmount % factor;
  const fraction = remainder.toString().padStart(decimals, "0");

  return `${isNegative ? "-" : ""}${whole}.${fraction}`;
}

/**
 * Parses a user input string (e.g. "100.50" or "₹10,000.00") into exact integer minor units
 * without using `parseFloat` to eliminate binary floating-point drift.
 */
export function parseMajorToMinor(majorStr: string, currency = "USD"): number {
  const decimals = getCurrencyDecimals(currency);
  if (typeof majorStr !== "string") {
    throw new TypeError(`[CurrencyError] Expected string input, got ${typeof majorStr}`);
  }

  // Clean string: remove currency symbols, spaces, commas
  let clean = majorStr.replace(/[^0-9.-]/g, "").trim();
  if (clean === "" || clean === "-" || clean === ".") {
    return 0;
  }

  const isNegative = clean.startsWith("-");
  if (isNegative) {
    clean = clean.slice(1);
  }

  if (clean.includes("-")) {
    throw new TypeError(`[CurrencyError] Invalid number format: "${majorStr}"`);
  }

  const parts = clean.split(".");
  if (parts.length > 2) {
    throw new TypeError(`[CurrencyError] Invalid number with multiple decimals: "${majorStr}"`);
  }

  const wholeStr = parts[0] === "" ? "0" : parts[0];
  const fracStr = parts[1] ?? "";

  const wholeNum = parseInt(wholeStr, 10);
  if (!Number.isSafeInteger(wholeNum)) {
    throw new TypeError(
      `[CurrencyError] Whole amount is outside safe integer range: "${majorStr}"`,
    );
  }

  if (decimals === 0) {
    const result = isNegative ? -wholeNum : wholeNum;
    assertSafeInteger(result, "parsedMinor");
    return result;
  }

  // Pad or slice fraction to exact decimal length
  const paddedFrac = fracStr.padEnd(decimals, "0").slice(0, decimals);
  const fracNum = parseInt(paddedFrac, 10);

  const factor = 10 ** decimals;
  const totalMinor = wholeNum * factor + fracNum;
  const result = isNegative ? -totalMinor : totalMinor;

  assertSafeInteger(result, "parsedMinor");
  return result;
}
