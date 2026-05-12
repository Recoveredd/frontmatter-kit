import type { FrontmatterPosition, FrontmatterRange } from "./types.js";

export function createLineIndex(source: string): number[] {
  const starts = [0];

  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") {
      starts.push(index + 1);
    }
  }

  return starts;
}

export function positionAt(offset: number, lineStarts: readonly number[]): FrontmatterPosition {
  let low = 0;
  let high = lineStarts.length - 1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const start = lineStarts[middle] ?? 0;
    const next = lineStarts[middle + 1] ?? Number.POSITIVE_INFINITY;

    if (offset < start) {
      high = middle - 1;
    } else if (offset >= next) {
      low = middle + 1;
    } else {
      return {
        offset,
        line: middle + 1,
        column: offset - start + 1
      };
    }
  }

  return {
    offset,
    line: lineStarts.length,
    column: Math.max(1, offset - (lineStarts.at(-1) ?? 0) + 1)
  };
}

export function rangeAt(start: number, end: number, lineStarts: readonly number[]): FrontmatterRange {
  return {
    start: positionAt(start, lineStarts),
    end: positionAt(end, lineStarts)
  };
}
