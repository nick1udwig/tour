import { describe, expect, it } from "bun:test";

import { parseCliArgs } from "../../packages/cli/src/args";

describe("CLI args", () => {
  it("parses required url and optional flags", () => {
    const parsed = parseCliArgs([
      "https://github.com/openai/codex",
      "--branch",
      "main",
      "--port",
      "4321",
      "--open",
      "--out",
      "/tmp/tour",
      "--model",
      "gpt-5-codex",
      "--max-duration",
      "55"
    ]);

    expect(parsed.ok).toBeTrue();
    expect(parsed.options?.branch).toBe("main");
    expect(parsed.options?.port).toBe(4321);
    expect(parsed.options?.open).toBeTrue();
    expect(parsed.options?.maxDurationMinutes).toBe(55);
  });

  it("fails invalid github url", () => {
    const parsed = parseCliArgs(["https://example.com/not-github"]);
    expect(parsed.ok).toBeFalse();
    expect(parsed.error).toContain("github.com");
  });
});
