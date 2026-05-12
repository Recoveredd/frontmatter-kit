import type { FrontmatterDiagnostic, FrontmatterRange, FrontmatterValue } from "./types.js";

export function parseScalar(value: string, diagnostics: FrontmatterDiagnostic[], range?: FrontmatterRange): FrontmatterValue {
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();

  if (trimmed === "") {
    return "";
  }

  if (lower === "true") {
    return true;
  }

  if (lower === "false") {
    return false;
  }

  if (lower === "null" || trimmed === "~") {
    return null;
  }

  if (isQuoted(trimmed)) {
    return unquote(trimmed, diagnostics, range);
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return parseInlineArray(trimmed, diagnostics, range);
  }

  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  return trimmed;
}

export function stringifyScalar(value: FrontmatterValue): string {
  if (typeof value === "string") {
    return /^[A-Za-z0-9_./:@-]+(?: [A-Za-z0-9_./:@-]+)*$/.test(value) ? value : JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stringifyScalar).join(", ")}]`;
  }

  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function parseInlineArray(value: string, diagnostics: FrontmatterDiagnostic[], range?: FrontmatterRange): FrontmatterValue[] {
  const content = value.slice(1, -1).trim();

  if (!content) {
    return [];
  }

  return splitCommaSeparated(content).map((item) => parseScalar(item, diagnostics, range));
}

function splitCommaSeparated(value: string): string[] {
  const items: string[] = [];
  let current = "";
  let quote: string | undefined;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index] ?? "";
    const previous = value[index - 1];

    if ((char === '"' || char === "'") && previous !== "\\") {
      quote = quote === char ? undefined : quote ?? char;
      current += char;
      continue;
    }

    if (char === "," && !quote) {
      items.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim() !== "") {
    items.push(current.trim());
  }

  return items;
}

function isQuoted(value: string): boolean {
  return (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"));
}

function unquote(value: string, diagnostics: FrontmatterDiagnostic[], range?: FrontmatterRange): string {
  if (value.startsWith("'")) {
    return value.slice(1, -1);
  }

  try {
    return JSON.parse(value) as string;
  } catch {
    diagnostics.push({
      code: "INVALID_QUOTED_STRING",
      severity: "warning",
      message: "Quoted string could not be decoded; raw content was kept.",
      range
    });
    return value.slice(1, -1);
  }
}
