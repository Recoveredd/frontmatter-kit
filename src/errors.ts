import type { FrontmatterDiagnostic, FrontmatterRange } from "./types.js";

export class FrontmatterParseError extends Error {
  readonly code: string;
  readonly range: FrontmatterRange | undefined;

  constructor(diagnostic: FrontmatterDiagnostic) {
    super(diagnostic.message);
    this.name = "FrontmatterParseError";
    this.code = diagnostic.code;
    this.range = diagnostic.range;
  }
}
