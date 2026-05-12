import { FrontmatterParseError } from "./errors.js";
import { parseMatter, stringifyMatter } from "./languages.js";
import { createLineIndex, rangeAt } from "./position.js";
import type {
  FrontmatterAttributes,
  FrontmatterDiagnostic,
  FrontmatterLanguage,
  FrontmatterParseOptions,
  FrontmatterRange,
  FrontmatterResult,
  FrontmatterStringifyOptions,
  FrontmatterTryResult
} from "./types.js";

export { FrontmatterParseError } from "./errors.js";
export type {
  FrontmatterAttributes,
  FrontmatterDelimiters,
  FrontmatterDiagnostic,
  FrontmatterLanguage,
  FrontmatterParseOptions,
  FrontmatterPosition,
  FrontmatterRange,
  FrontmatterRanges,
  FrontmatterResult,
  FrontmatterSeverity,
  FrontmatterStringifyOptions,
  FrontmatterTryResult,
  FrontmatterValue
} from "./types.js";

const DEFAULT_EXCERPT_SEPARATOR = "<!-- more -->";

export function parseFrontmatter<TAttributes extends FrontmatterAttributes = FrontmatterAttributes>(
  source: string,
  options: FrontmatterParseOptions = {}
): FrontmatterResult<TAttributes> {
  const lineStarts = createLineIndex(source);
  const diagnostics: FrontmatterDiagnostic[] = [];
  const opening = readOpening(source);

  if (!opening) {
    return {
      hasFrontmatter: false,
      attributes: {} as TAttributes,
      body: source,
      matter: "",
      ranges: {
        body: rangeAt(0, source.length, lineStarts)
      },
      diagnostics
    };
  }

  const closing = findClosing(source, opening.contentStart, opening.delimiter);
  const openingRange = rangeAt(opening.start, opening.contentStart, lineStarts);

  if (!closing) {
    diagnostics.push({
      code: "MISSING_CLOSING_DELIMITER",
      severity: "error",
      message: `Missing closing front matter delimiter "${opening.delimiter}".`,
      range: openingRange
    });

    return {
      hasFrontmatter: false,
      attributes: {} as TAttributes,
      body: source.slice(opening.contentStart),
      matter: source.slice(opening.contentStart),
      language: inferLanguage(opening, source.slice(opening.contentStart), options.language),
      delimiters: {
        opening: opening.delimiter,
        closing: opening.delimiter
      },
      ranges: {
        opening: openingRange,
        matter: rangeAt(opening.contentStart, source.length, lineStarts),
        body: rangeAt(opening.contentStart, source.length, lineStarts)
      },
      diagnostics
    };
  }

  const matter = source.slice(opening.contentStart, closing.start);
  const body = source.slice(closing.end);
  const language = inferLanguage(opening, matter, options.language);
  const matterRange = rangeAt(opening.contentStart, closing.start, lineStarts);
  const attributes = parseMatter(matter, language, diagnostics, matterRange) as TAttributes;
  const excerpt = readExcerpt(body, closing.end, source, lineStarts, options.excerptSeparator ?? DEFAULT_EXCERPT_SEPARATOR);

  return {
    hasFrontmatter: true,
    attributes,
    body,
    matter,
    language,
    delimiters: {
      opening: opening.delimiter,
      closing: opening.delimiter
    },
    excerpt: excerpt?.text,
    ranges: {
      opening: openingRange,
      matter: matterRange,
      closing: rangeAt(closing.start, closing.end, lineStarts),
      body: rangeAt(closing.end, source.length, lineStarts),
      ...(excerpt ? { excerpt: excerpt.range } : {})
    },
    diagnostics
  };
}

export function tryParseFrontmatter<TAttributes extends FrontmatterAttributes = FrontmatterAttributes>(
  source: string,
  options?: FrontmatterParseOptions
): FrontmatterTryResult<TAttributes> {
  try {
    return {
      ok: true,
      result: parseFrontmatter<TAttributes>(source, options)
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error("Unknown front matter parsing error.")
    };
  }
}

export function parseFrontmatterOrThrow<TAttributes extends FrontmatterAttributes = FrontmatterAttributes>(
  source: string,
  options?: FrontmatterParseOptions
): FrontmatterResult<TAttributes> {
  const result = parseFrontmatter<TAttributes>(source, options);
  const error = result.diagnostics.find((diagnostic) => diagnostic.severity === "error");

  if (error) {
    throw new FrontmatterParseError(error);
  }

  return result;
}

export function stringifyFrontmatter(
  attributes: FrontmatterAttributes,
  body = "",
  options: FrontmatterStringifyOptions = {}
): string {
  const language = options.language ?? "yaml";
  const delimiter = options.delimiter ?? (language === "toml" ? "+++" : "---");
  const suffix = language === "yaml" ? "" : language;
  const opening = `${delimiter}${suffix}`;

  return `${opening}\n${stringifyMatter(attributes, language)}\n${delimiter}\n${body}`;
}

export function hasFrontmatter(source: string): boolean {
  return Boolean(readOpening(source));
}

interface Opening {
  start: number;
  contentStart: number;
  delimiter: "---" | "+++";
  languageHint?: FrontmatterLanguage;
}

interface Closing {
  start: number;
  end: number;
}

function readOpening(source: string): Opening | undefined {
  const match = /^\uFEFF?(---|\+\+\+)([A-Za-z0-9_-]+)?[ \t]*(?:\r?\n|$)/.exec(source);

  if (!match) {
    return undefined;
  }

  const delimiter = match[1] as "---" | "+++";
  const hint = normalizeLanguage(match[2]);

  return {
    start: 0,
    contentStart: match[0].length,
    delimiter,
    ...(hint ? { languageHint: hint } : {})
  };
}

function findClosing(source: string, offset: number, delimiter: "---" | "+++"): Closing | undefined {
  let lineStart = offset;

  while (lineStart <= source.length) {
    const lineEnd = findLineEnd(source, lineStart);
    const line = source.slice(lineStart, lineEnd).trim();

    if (line === delimiter) {
      return {
        start: lineStart,
        end: consumeLineBreak(source, lineEnd)
      };
    }

    if (lineEnd >= source.length) {
      break;
    }

    lineStart = consumeLineBreak(source, lineEnd);
  }

  return undefined;
}

function inferLanguage(opening: Opening, matter: string, forced?: FrontmatterLanguage): FrontmatterLanguage {
  if (forced) {
    return forced;
  }

  if (opening.languageHint) {
    return opening.languageHint;
  }

  if (opening.delimiter === "+++") {
    return "toml";
  }

  return matter.trimStart().startsWith("{") ? "json" : "yaml";
}

function normalizeLanguage(value: string | undefined): FrontmatterLanguage | undefined {
  if (value === "yaml" || value === "yml") {
    return "yaml";
  }

  if (value === "json") {
    return "json";
  }

  if (value === "toml") {
    return "toml";
  }

  return undefined;
}

function readExcerpt(
  body: string,
  bodyOffset: number,
  source: string,
  lineStarts: readonly number[],
  separator: string | false
): { text: string; range: FrontmatterRange } | undefined {
  if (separator === false || separator === "") {
    return undefined;
  }

  const index = body.indexOf(separator);

  if (index === -1) {
    return undefined;
  }

  const start = bodyOffset;
  const end = bodyOffset + index;

  return {
    text: source.slice(start, end).trimEnd(),
    range: rangeAt(start, end, lineStarts)
  };
}

function findLineEnd(source: string, offset: number): number {
  const next = source.indexOf("\n", offset);
  return next === -1 ? source.length : source[next - 1] === "\r" ? next - 1 : next;
}

function consumeLineBreak(source: string, offset: number): number {
  if (source[offset] === "\r" && source[offset + 1] === "\n") {
    return offset + 2;
  }

  if (source[offset] === "\n") {
    return offset + 1;
  }

  return offset;
}
