import { describe, expect, it } from "vitest";
import {
  FrontmatterParseError,
  hasFrontmatter,
  parseFrontmatter,
  parseFrontmatterOrThrow,
  stringifyFrontmatter,
  tryParseFrontmatter
} from "../src/index.js";

describe("parseFrontmatter", () => {
  it("parses YAML front matter with body ranges", () => {
    const result = parseFrontmatter(`---
title: Hello world
draft: false
tags:
  - docs
  - release
author:
  name: Ada
---
# Hello

Body`);

    expect(result.hasFrontmatter).toBe(true);
    expect(result.language).toBe("yaml");
    expect(result.attributes).toEqual({
      title: "Hello world",
      draft: false,
      tags: ["docs", "release"],
      author: { name: "Ada" }
    });
    expect(result.body).toBe("# Hello\n\nBody");
    expect(result.ranges.opening?.start.line).toBe(1);
    expect(result.ranges.body.start.line).toBe(10);
    expect(result.diagnostics).toEqual([]);
  });

  it("parses TOML front matter from plus delimiters", () => {
    const result = parseFrontmatter(`+++
title = "Release"
draft = false
tags = ["docs", "api"]
[author]
name = "Ada"
+++
Body`);

    expect(result.language).toBe("toml");
    expect(result.attributes).toEqual({
      title: "Release",
      draft: false,
      tags: ["docs", "api"],
      author: { name: "Ada" }
    });
  });

  it("parses JSON front matter when marker says json", () => {
    const result = parseFrontmatter(`---json
{
  "title": "JSON post",
  "draft": true
}
---
Body`);

    expect(result.language).toBe("json");
    expect(result.attributes).toEqual({
      title: "JSON post",
      draft: true
    });
  });

  it("warns about unknown language hints", () => {
    const result = parseFrontmatter(`---weird
title: Fallback
---
Body`);

    expect(result.language).toBe("yaml");
    expect(result.attributes).toEqual({ title: "Fallback" });
    expect(result.diagnostics[0]?.code).toBe("UNKNOWN_LANGUAGE_HINT");
  });

  it("returns the entire document as body when no front matter is present", () => {
    const result = parseFrontmatter("# Plain document");

    expect(result.hasFrontmatter).toBe(false);
    expect(result.attributes).toEqual({});
    expect(result.body).toBe("# Plain document");
    expect(result.diagnostics).toEqual([]);
  });

  it("reports missing closing delimiters without throwing by default", () => {
    const result = parseFrontmatter(`---
title: Broken`);

    expect(result.hasFrontmatter).toBe(false);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe("MISSING_CLOSING_DELIMITER");
  });

  it("throws the first diagnostic error with parseFrontmatterOrThrow", () => {
    expect(() => parseFrontmatterOrThrow(`---
title: Broken`)).toThrow(FrontmatterParseError);
  });

  it("keeps invalid JSON as diagnostics", () => {
    const result = parseFrontmatter(`---json
{ "title": }
---
Body`);

    expect(result.attributes).toEqual({});
    expect(result.diagnostics[0]?.code).toBe("INVALID_JSON_FRONTMATTER");
  });

  it("extracts excerpts from the body", () => {
    const result = parseFrontmatter(`---
title: Excerpt
---
Intro paragraph.
<!-- more -->
Rest of the article.`);

    expect(result.excerpt).toBe("Intro paragraph.");
    expect(result.ranges.excerpt?.start.line).toBe(4);
  });

  it("can disable excerpt parsing", () => {
    const result = parseFrontmatter(`---
title: No excerpt
---
Intro
<!-- more -->
Rest`, { excerptSeparator: false });

    expect(result.excerpt).toBeUndefined();
  });

  it("detects front matter markers", () => {
    expect(hasFrontmatter("---\ntitle: Hi\n---\nBody")).toBe(true);
    expect(hasFrontmatter("# No marker")).toBe(false);
  });

  it("wraps unexpected errors in tryParseFrontmatter", () => {
    const result = tryParseFrontmatter("---\ntitle: Hi\n---\nBody");

    expect(result.ok).toBe(true);
  });
});

describe("stringifyFrontmatter", () => {
  it("serializes YAML front matter", () => {
    expect(stringifyFrontmatter({ title: "Hello", tags: ["docs", "api"] }, "Body")).toBe(`---
title: Hello
tags:
  - docs
  - api
---
Body`);
  });

  it("serializes TOML front matter", () => {
    expect(stringifyFrontmatter({ title: "Hello", draft: false }, "Body", { language: "toml" })).toBe(`+++toml
title = "Hello"
draft = false
+++
Body`);
  });
});
