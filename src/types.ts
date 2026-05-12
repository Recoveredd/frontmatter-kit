export type FrontmatterLanguage = "yaml" | "json" | "toml";

export type FrontmatterSeverity = "info" | "warning" | "error";

export type FrontmatterValue =
  | string
  | number
  | boolean
  | null
  | FrontmatterValue[]
  | { [key: string]: FrontmatterValue };

export type FrontmatterAttributes = Record<string, FrontmatterValue>;

export interface FrontmatterPosition {
  offset: number;
  line: number;
  column: number;
}

export interface FrontmatterRange {
  start: FrontmatterPosition;
  end: FrontmatterPosition;
}

export interface FrontmatterDiagnostic {
  code: string;
  severity: FrontmatterSeverity;
  message: string;
  range?: FrontmatterRange | undefined;
}

export interface FrontmatterRanges {
  opening?: FrontmatterRange;
  matter?: FrontmatterRange;
  closing?: FrontmatterRange;
  body: FrontmatterRange;
  excerpt?: FrontmatterRange;
}

export interface FrontmatterDelimiters {
  opening: string;
  closing: string;
}

export interface FrontmatterParseOptions {
  /**
   * Force a front matter language instead of inferring it from the opening
   * marker. `+++` still defaults to TOML when this option is omitted.
   */
  language?: FrontmatterLanguage;
  /**
   * Marker used to derive the optional excerpt.
   *
   * @default "<!-- more -->"
   */
  excerptSeparator?: string | false;
}

export interface FrontmatterStringifyOptions {
  language?: FrontmatterLanguage;
  delimiter?: "---" | "+++";
}

export interface FrontmatterResult<TAttributes extends FrontmatterAttributes = FrontmatterAttributes> {
  hasFrontmatter: boolean;
  attributes: TAttributes;
  body: string;
  matter: string;
  language?: FrontmatterLanguage;
  delimiters?: FrontmatterDelimiters;
  excerpt?: string | undefined;
  ranges: FrontmatterRanges;
  diagnostics: FrontmatterDiagnostic[];
}

export type FrontmatterTryResult<TAttributes extends FrontmatterAttributes = FrontmatterAttributes> =
  | {
      ok: true;
      result: FrontmatterResult<TAttributes>;
    }
  | {
      ok: false;
      error: Error;
    };
