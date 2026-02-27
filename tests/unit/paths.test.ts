import { describe, expect, it } from "bun:test";

import { buildRunPaths, formatUtcTimestamp, resolveTourRoot } from "@tour/core";

describe("paths", () => {
  it("formats UTC timestamp as YYYYMMDD-HHmmssZ", () => {
    const timestamp = formatUtcTimestamp(new Date("2026-02-27T18:45:00.000Z"));
    expect(timestamp).toBe("20260227-184500Z");
  });

  it("resolves explicit output path first", () => {
    const resolved = resolveTourRoot("./tmp-out", { TOUR_HOME: "/tmp/ignored" });
    expect(resolved.endsWith("tmp-out")).toBeTrue();
  });

  it("resolves TOUR_HOME env override", () => {
    const resolved = resolveTourRoot(undefined, { TOUR_HOME: "/tmp/tour-home" });
    expect(resolved).toBe("/tmp/tour-home");
  });

  it("builds artifact layout", () => {
    const paths = buildRunPaths({
      root: "/tmp/tour",
      owner: "openai",
      repo: "codex",
      timestamp: "20260227-184500Z"
    });

    expect(paths.runRoot).toBe("/tmp/tour/openai/codex/20260227-184500Z");
    expect(paths.repoDir).toBe("/tmp/tour/openai/codex/20260227-184500Z/repo");
    expect(paths.slidesMarkdownPath.endsWith("slides/tour.md")).toBeTrue();
  });
});
