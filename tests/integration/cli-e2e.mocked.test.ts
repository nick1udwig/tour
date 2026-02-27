import { mkdir } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "bun:test";

import { orchestrateTour } from "../../packages/cli/src/orchestrator";

import { withTempDir } from "../helpers";

afterEach(() => {
  delete process.env.TOUR_NO_KEEPALIVE;
});

describe("CLI orchestration (mocked)", () => {
  it("runs full pipeline and writes artifacts", async () => {
    await withTempDir(async (tempDir) => {
      process.env.TOUR_NO_KEEPALIVE = "1";

      const localRepo = path.join(tempDir, "repo-seed");
      await mkdir(localRepo, { recursive: true });
      await Bun.write(path.join(localRepo, "index.ts"), "export const x = 1;\n");

      const result = await orchestrateTour(
        {
          githubUrl: "https://github.com/openai/codex",
          open: false,
          out: tempDir
        },
        {
          cloneRepository: async () => ({
            owner: "openai",
            repo: "codex",
            cloneUrl: "",
            htmlUrl: "https://github.com/openai/codex",
            branch: "main",
            commitSha: "abc123",
            localPath: localRepo
          }),
          generateWithCodex: async () => ({
            result: {
              markdown: [
                "# Architecture map",
                "Architecture and runtime data flow.",
                "",
                "---",
                "# Build and run setup",
                "Build and run test setup.",
                "",
                "---",
                "# Where to start",
                "Entry point for bug fix work."
              ].join("\n"),
              usage: null,
              threadId: "thread"
            },
            model: {
              provider: "codex-sdk",
              package: "@openai/codex-sdk",
              packageVersion: "0.106.0",
              model: "gpt-5.3-codex",
              temperature: 0,
              modelReasoningEffort: "medium"
            }
          }),
          startTourServer: async () => ({
            url: "http://127.0.0.1:4000",
            port: 4000,
            close: async () => {}
          })
        }
      );

      expect(result.exitCode).toBe(0);
      expect(result.url).toContain("jobId=");
      const markdownPath = path.join(result.runRoot, "slides", "tour.md");
      expect(await Bun.file(markdownPath).exists()).toBeTrue();
    });
  });
});
