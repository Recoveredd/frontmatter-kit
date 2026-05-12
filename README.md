# frontmatter-kit

[![npm version](https://img.shields.io/npm/v/frontmatter-kit.svg)](https://www.npmjs.com/package/frontmatter-kit)
[![License: MPL-2.0](https://img.shields.io/badge/license-MPL--2.0-blue.svg)](LICENSE)
[![CI](https://github.com/Recoveredd/frontmatter-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/Recoveredd/frontmatter-kit/actions/workflows/ci.yml)

Parse and inspect front matter with typed metadata, body ranges and readable diagnostics.

`frontmatter-kit` is a small clean-room toolkit for Markdown/content tools that need more than
`attributes + body`. It parses front matter, exposes line/column ranges, reports malformed
delimiters and metadata errors, and keeps the result easy to render in previews or docs dashboards.

Links: [npm](https://www.npmjs.com/package/frontmatter-kit) · [GitHub](https://github.com/Recoveredd/frontmatter-kit)

## Package quality

- TypeScript types are generated from the source.
- ESM-only package with no runtime dependencies.
- Marked as side-effect free for bundlers.
- Tested on Node.js 20 and 22 with GitHub Actions.
- Works in Node.js, browsers, Vite apps and static docs tooling.

## Install

```bash
npm install frontmatter-kit
```

## Quick Start

```ts
import { parseFrontmatter } from "frontmatter-kit";

const result = parseFrontmatter(`---
title: Release notes
draft: false
tags:
  - docs
  - release
---
# Release notes

Short intro.
<!-- more -->
Full article.`);

result.attributes;
// { title: "Release notes", draft: false, tags: ["docs", "release"] }

result.body;
// "# Release notes\n\nShort intro.\n<!-- more -->\nFull article."

result.excerpt;
// "# Release notes\n\nShort intro."

result.ranges.matter?.start.line;
// 2
```

## Why not just another front matter parser?

Use `gray-matter` when you need a broad, mature parser with many ecosystem integrations.

Use `frontmatter-kit` when you are building an inspector, editor, docs preview, static dashboard
or content QA tool and need:

- predictable TypeScript result shapes;
- diagnostics instead of only thrown errors;
- line/column ranges for the opening marker, metadata block, closing marker, body and excerpt;
- a small browser-friendly package with no runtime dependencies.

## Supported formats

| Marker | Format |
| --- | --- |
| `---` | YAML-like key/value front matter |
| `---yaml` / `---yml` | YAML-like key/value front matter |
| `---json` | JSON object front matter |
| `+++` / `+++toml` | TOML-like key/value front matter |

The YAML and TOML parsers are intentionally small. They cover common metadata shapes: strings,
numbers, booleans, nulls, inline arrays, simple nested objects and simple lists. They are designed
for content metadata, not for full YAML or TOML language coverage.

## API

### `parseFrontmatter(source, options?)`

Returns a structured result and never throws for normal syntax problems. Errors are reported in
`diagnostics`.

```ts
import { parseFrontmatter } from "frontmatter-kit";

const result = parseFrontmatter(source, {
  excerptSeparator: "<!-- more -->"
});

if (result.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
  console.log(result.diagnostics);
}
```

Result shape:

```ts
type FrontmatterResult = {
  hasFrontmatter: boolean;
  attributes: Record<string, FrontmatterValue>;
  body: string;
  matter: string;
  language?: "yaml" | "json" | "toml";
  excerpt?: string;
  ranges: {
    opening?: FrontmatterRange;
    matter?: FrontmatterRange;
    closing?: FrontmatterRange;
    body: FrontmatterRange;
    excerpt?: FrontmatterRange;
  };
  diagnostics: FrontmatterDiagnostic[];
};
```

Options:

| Option | Default | Description |
| --- | --- | --- |
| `language` | inferred | Force `yaml`, `json` or `toml`. |
| `excerptSeparator` | `<!-- more -->` | Marker used to derive `excerpt`. Set `false` to disable. |

### `parseFrontmatterOrThrow(source, options?)`

Returns the same result as `parseFrontmatter()`, but throws `FrontmatterParseError` when an error
diagnostic is present.

```ts
import { parseFrontmatterOrThrow } from "frontmatter-kit";

const result = parseFrontmatterOrThrow(source);
```

### `tryParseFrontmatter(source, options?)`

Wraps unexpected runtime errors in a result object.

```ts
import { tryParseFrontmatter } from "frontmatter-kit";

const parsed = tryParseFrontmatter(source);

if (parsed.ok) {
  console.log(parsed.result.attributes);
}
```

### `hasFrontmatter(source)`

Checks whether a source string begins with a supported front matter marker.

```ts
import { hasFrontmatter } from "frontmatter-kit";

hasFrontmatter("---\ntitle: Hi\n---\nBody");
// true
```

### `stringifyFrontmatter(attributes, body?, options?)`

Serializes a small metadata object back to a front matter document.

```ts
import { stringifyFrontmatter } from "frontmatter-kit";

stringifyFrontmatter({ title: "Hello", draft: false }, "# Hello");
```

## Diagnostics

Malformed documents stay inspectable:

```ts
const result = parseFrontmatter(`---
title: Missing close`);

result.diagnostics;
// [{ code: "MISSING_CLOSING_DELIMITER", severity: "error", ... }]
```

Each diagnostic can include a line/column range so editors and playgrounds can highlight the
problem directly.

## Notes

- This package does not execute code and does not load external resources.
- The YAML/TOML support is intentionally pragmatic rather than exhaustive.
- The implementation is clean-room and does not copy code from `front-matter`, `gray-matter` or
  related packages.

## License

MPL-2.0
