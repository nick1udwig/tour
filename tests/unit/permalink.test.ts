import { describe, expect, it } from "bun:test";

import { buildGitHubPermalink } from "@tour/core";

describe("permalink", () => {
  it("builds commit pinned range links", () => {
    const url = buildGitHubPermalink({
      owner: "openai",
      repo: "codex",
      sha: "abc123",
      path: "src/index.ts",
      startLine: 10,
      endLine: 20
    });

    expect(url).toBe("https://github.com/openai/codex/blob/abc123/src/index.ts#L10-L20");
  });

  it("falls back to file link when range invalid", () => {
    const url = buildGitHubPermalink({
      owner: "openai",
      repo: "codex",
      sha: "abc123",
      path: "/src/index.ts",
      startLine: 20,
      endLine: 10
    });

    expect(url).toBe("https://github.com/openai/codex/blob/abc123/src/index.ts#L20");
  });
});
