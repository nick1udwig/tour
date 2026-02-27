import { describe, expect, it } from "bun:test";

import { parseCliArgs } from "../../packages/cli/src/args";

describe("CLI args", () => {
  it("parses required url and optional flags", () => {
    const parsed = parseCliArgs([
      "https://github.com/nick1udwig/tour",
      "--branch",
      "main",
      "--port",
      "4321",
      "--open",
      "--out",
      "/tmp/tour",
      "--model",
      "gpt-5.3-codex",
      "--reasoning-effort",
      "high",
      "--max-duration",
      "55"
    ]);

    expect(parsed.ok).toBeTrue();
    expect(parsed.options?.branch).toBe("main");
    expect(parsed.options?.port).toBe(4321);
    expect(parsed.options?.open).toBeTrue();
    expect(parsed.options?.model).toBe("gpt-5.3-codex");
    expect(parsed.options?.reasoningEffort).toBe("high");
    expect(parsed.options?.maxDurationMinutes).toBe(55);
  });

  it("uses TOUR_MODEL and TOUR_REASONING_EFFORT env defaults", () => {
    const parsed = parseCliArgs(
      ["https://github.com/nick1udwig/tour"],
      {
        TOUR_MODEL: "gpt-5.3-codex",
        TOUR_REASONING_EFFORT: "medium"
      }
    );

    expect(parsed.ok).toBeTrue();
    expect(parsed.options?.model).toBe("gpt-5.3-codex");
    expect(parsed.options?.reasoningEffort).toBe("medium");
  });

  it("fails invalid github url", () => {
    const parsed = parseCliArgs(["https://example.com/not-github"]);
    expect(parsed.ok).toBeFalse();
    expect(parsed.error).toContain("github.com");
  });

  it("fails invalid reasoning effort from env", () => {
    const parsed = parseCliArgs(
      ["https://github.com/nick1udwig/tour"],
      {
        TOUR_REASONING_EFFORT: "wrong"
      }
    );
    expect(parsed.ok).toBeFalse();
    expect(parsed.error).toContain("TOUR_REASONING_EFFORT");
  });
});
