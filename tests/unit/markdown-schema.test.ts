import { describe, expect, it } from "bun:test";

import { normalizeMarkdown, validateMarkdownContract } from "@tour/core";

const VALID_MARKDOWN = [
  "# Architecture map",
  "A quick architecture summary.",
  "",
  "## Runtime flow",
  "- architecture and data flow are captured here.",
  "",
  "```ts path=src/index.ts lines=1-3 permalink=https://github.com/openai/codex/blob/abc/src/index.ts#L1-L3",
  "const app = 1;",
  "const run = app + 1;",
  "console.log(run);",
  "```",
  "",
  "---",
  "# Build and run setup",
  "Run build, run test, and setup commands.",
  "",
  "---",
  "# Where to start",
  "Start here for first feature or bug fix entry point."
].join("\n");

describe("markdown schema", () => {
  it("validates required sections and snippet metadata", () => {
    const result = validateMarkdownContract(VALID_MARKDOWN);
    expect(result.ok).toBeTrue();
    expect(result.slideCount).toBe(3);
  });

  it("rejects missing required sections", () => {
    const result = validateMarkdownContract("# Intro\njust text");
    expect(result.ok).toBeFalse();
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("normalizes markdown deterministically", () => {
    const normalized = normalizeMarkdown("# X\r\n\r\n\r\nA  \r\n");
    expect(normalized).toBe("# X\n\nA\n");
  });
});
