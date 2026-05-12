import { parseScalar, stringifyScalar } from "./scalars.js";
import type { FrontmatterAttributes, FrontmatterDiagnostic, FrontmatterLanguage, FrontmatterRange, FrontmatterValue } from "./types.js";

export function parseMatter(
  matter: string,
  language: FrontmatterLanguage,
  diagnostics: FrontmatterDiagnostic[],
  range?: FrontmatterRange
): FrontmatterAttributes {
  if (language === "json") {
    return parseJsonMatter(matter, diagnostics, range);
  }

  if (language === "toml") {
    return parseTomlMatter(matter, diagnostics, range);
  }

  return parseYamlMatter(matter, diagnostics, range);
}

export function stringifyMatter(attributes: FrontmatterAttributes, language: FrontmatterLanguage): string {
  if (language === "json") {
    return JSON.stringify(attributes, null, 2);
  }

  if (language === "toml") {
    return stringifyToml(attributes);
  }

  return stringifyYaml(attributes);
}

function parseJsonMatter(matter: string, diagnostics: FrontmatterDiagnostic[], range?: FrontmatterRange): FrontmatterAttributes {
  try {
    const value = JSON.parse(matter) as unknown;

    if (!isPlainObject(value)) {
      diagnostics.push({
        code: "JSON_FRONTMATTER_NOT_OBJECT",
        severity: "error",
        message: "JSON front matter must parse to an object.",
        range
      });
      return {};
    }

    return value as FrontmatterAttributes;
  } catch (error) {
    diagnostics.push({
      code: "INVALID_JSON_FRONTMATTER",
      severity: "error",
      message: error instanceof Error ? error.message : "Invalid JSON front matter.",
      range
    });
    return {};
  }
}

function parseYamlMatter(matter: string, diagnostics: FrontmatterDiagnostic[], range?: FrontmatterRange): FrontmatterAttributes {
  const attributes: FrontmatterAttributes = {};
  const lines = matter.replace(/\r\n?/g, "\n").split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";

    if (isIgnorable(line)) {
      continue;
    }

    if (/^\s/.test(line)) {
      diagnostics.push({
        code: "UNEXPECTED_INDENT",
        severity: "warning",
        message: "Indented YAML line was ignored because it is not attached to a top-level key.",
        range
      });
      continue;
    }

    const separator = line.indexOf(":");

    if (separator <= 0) {
      diagnostics.push({
        code: "INVALID_YAML_LINE",
        severity: "warning",
        message: `YAML line ${index + 1} does not look like a key/value pair.`,
        range
      });
      continue;
    }

    const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();

    if (!key) {
      continue;
    }

    if (rawValue !== "") {
      setPathValue(attributes, key, parseScalar(rawValue, diagnostics, range));
      continue;
    }

    const block = collectIndentedBlock(lines, index + 1);
    index = block.nextIndex - 1;
    setPathValue(attributes, key, parseYamlBlock(block.lines, diagnostics, range));
  }

  return attributes;
}

function parseYamlBlock(lines: string[], diagnostics: FrontmatterDiagnostic[], range?: FrontmatterRange): FrontmatterValue {
  const meaningful = lines.filter((line) => !isIgnorable(line));

  if (meaningful.length === 0) {
    return "";
  }

  if (meaningful.every((line) => line.trimStart().startsWith("- "))) {
    return meaningful.map((line) => parseScalar(line.trimStart().slice(2), diagnostics, range));
  }

  const object: FrontmatterAttributes = {};

  for (const line of meaningful) {
    const trimmed = line.trim();
    const separator = trimmed.indexOf(":");

    if (separator <= 0) {
      diagnostics.push({
        code: "INVALID_YAML_BLOCK_LINE",
        severity: "warning",
        message: "Nested YAML line was ignored because it is not a key/value pair.",
        range
      });
      continue;
    }

    object[trimmed.slice(0, separator).trim()] = parseScalar(trimmed.slice(separator + 1), diagnostics, range);
  }

  return object;
}

function collectIndentedBlock(lines: string[], startIndex: number): { lines: string[]; nextIndex: number } {
  const block: string[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index] ?? "";

    if (line.trim() !== "" && !/^\s/.test(line)) {
      break;
    }

    block.push(line);
    index += 1;
  }

  return { lines: block, nextIndex: index };
}

function parseTomlMatter(matter: string, diagnostics: FrontmatterDiagnostic[], range?: FrontmatterRange): FrontmatterAttributes {
  const attributes: FrontmatterAttributes = {};
  let section: string[] = [];

  matter.replace(/\r\n?/g, "\n").split("\n").forEach((line, index) => {
    const trimmed = line.trim();

    if (trimmed === "" || trimmed.startsWith("#")) {
      return;
    }

    const sectionMatch = /^\[([A-Za-z0-9_.-]+)\]$/.exec(trimmed);

    if (sectionMatch) {
      section = (sectionMatch[1] ?? "").split(".");
      return;
    }

    const separator = trimmed.indexOf("=");

    if (separator <= 0) {
      diagnostics.push({
        code: "INVALID_TOML_LINE",
        severity: "warning",
        message: `TOML line ${index + 1} does not look like a key/value pair.`,
        range
      });
      return;
    }

    setSegmentsValue(
      attributes,
      [...section, trimmed.slice(0, separator).trim()],
      parseScalar(trimmed.slice(separator + 1), diagnostics, range)
    );
  });

  return attributes;
}

function stringifyYaml(attributes: FrontmatterAttributes): string {
  return Object.entries(attributes)
    .map(([key, value]) => stringifyYamlEntry(key, value))
    .join("\n");
}

function stringifyYamlEntry(key: string, value: FrontmatterValue): string {
  if (Array.isArray(value)) {
    return `${key}:\n${value.map((item) => `  - ${stringifyScalar(item)}`).join("\n")}`;
  }

  if (value && typeof value === "object") {
    return `${key}:\n${Object.entries(value)
      .map(([childKey, childValue]) => `  ${childKey}: ${stringifyScalar(childValue)}`)
      .join("\n")}`;
  }

  return `${key}: ${stringifyScalar(value)}`;
}

function stringifyToml(attributes: FrontmatterAttributes): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(attributes)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      lines.push(`[${key}]`);
      for (const [childKey, childValue] of Object.entries(value)) {
        lines.push(`${childKey} = ${stringifyScalar(childValue)}`);
      }
    } else {
      lines.push(`${key} = ${stringifyScalar(value)}`);
    }
  }

  return lines.join("\n");
}

function setPathValue(target: FrontmatterAttributes, path: string, value: FrontmatterValue): void {
  setSegmentsValue(target, path.split("."), value);
}

function setSegmentsValue(target: FrontmatterAttributes, segments: string[], value: FrontmatterValue): void {
  let current: FrontmatterAttributes = target;

  segments.forEach((segment, index) => {
    if (index === segments.length - 1) {
      current[segment] = value;
      return;
    }

    const next = current[segment];

    if (!isPlainObject(next)) {
      current[segment] = {};
    }

    current = current[segment] as FrontmatterAttributes;
  });
}

function isIgnorable(line: string): boolean {
  const trimmed = line.trim();
  return trimmed === "" || trimmed.startsWith("#");
}

function isPlainObject(value: unknown): value is Record<string, FrontmatterValue> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
