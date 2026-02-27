import { writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "bun:test";

import { buildRunPaths, writeArtifacts } from "@tour/core";

import { withTempDir } from "../helpers";

describe("artifacts", () => {
  it("writes expected artifact layout", async () => {
    await withTempDir(async (root) => {
      const paths = buildRunPaths({
        root,
        owner: "a",
        repo: "b",
        timestamp: "20260227-184500Z"
      });

      await writeArtifacts({
        paths,
        markdown: "# deck\n",
        normalizedMarkdown: "# deck\n",
        context: {
          version: "v1",
          repo: {
            owner: "a",
            repo: "b",
            branch: "main",
            commitSha: "sha"
          },
          files: []
        },
        prompt: {
          version: "tour-v1",
          sha256: "hash",
          prompt: "prompt"
        },
        model: {
          provider: "codex-sdk",
          package: "@openai/codex-sdk",
          packageVersion: "0.106.0",
          model: "gpt-5.3-codex",
          temperature: 0,
          modelReasoningEffort: "medium"
        },
        meta: {
          jobId: "job",
          startedAt: "2026-02-27T00:00:00.000Z",
          outputRoot: paths.runRoot,
          repo: {
            owner: "a",
            repo: "b",
            branch: "main",
            commitSha: "sha",
            htmlUrl: "https://github.com/a/b"
          },
          prompt: {
            version: "tour-v1",
            sha256: "hash"
          },
          model: {
            provider: "codex-sdk",
            package: "@openai/codex-sdk",
            packageVersion: "0.106.0",
            model: "gpt-5.3-codex",
            temperature: 0,
            modelReasoningEffort: "medium"
          },
          status: "ready"
        }
      });

      const markdown = await Bun.file(paths.slidesMarkdownPath).text();
      expect(markdown).toContain("# deck");
      expect(await Bun.file(paths.modelPath).exists()).toBeTrue();
      expect(await Bun.file(paths.jobMetaPath).exists()).toBeTrue();
    });
  });

  it("surfaces clear errors when write path is invalid", async () => {
    await withTempDir(async (root) => {
      const blocker = path.join(root, "blocked");
      await writeFile(blocker, "x", "utf8");

      const paths = {
        root,
        runRoot: blocker,
        repoDir: path.join(blocker, "repo"),
        slidesDir: path.join(blocker, "slides"),
        metaDir: path.join(blocker, "meta"),
        logsDir: path.join(blocker, "logs"),
        logFile: path.join(blocker, "logs", "generation.log"),
        slidesMarkdownPath: path.join(blocker, "slides", "tour.md"),
        slidesNormalizedPath: path.join(blocker, "slides", "tour.normalized.md"),
        jobMetaPath: path.join(blocker, "meta", "job.json"),
        promptPath: path.join(blocker, "meta", "prompt.txt"),
        contextPath: path.join(blocker, "meta", "context.json"),
        modelPath: path.join(blocker, "meta", "model.json")
      };

      await expect(
        writeArtifacts({
          paths,
          markdown: "",
          normalizedMarkdown: "",
          context: {
            version: "v1",
            repo: {
              owner: "a",
              repo: "b",
              branch: "main",
              commitSha: "sha"
            },
            files: []
          },
          prompt: {
            version: "tour-v1",
            sha256: "hash",
            prompt: ""
          },
          model: {
            provider: "codex-sdk",
            package: "@openai/codex-sdk",
            packageVersion: "0.106.0",
            model: "gpt-5.3-codex",
            temperature: 0,
            modelReasoningEffort: "medium"
          },
          meta: {
            jobId: "job",
            startedAt: "2026-02-27T00:00:00.000Z",
            outputRoot: blocker,
            repo: {
              owner: "a",
              repo: "b",
              branch: "main",
              commitSha: "sha",
              htmlUrl: "https://github.com/a/b"
            },
            prompt: {
              version: "tour-v1",
              sha256: "hash"
            },
            model: {
              provider: "codex-sdk",
              package: "@openai/codex-sdk",
              packageVersion: "0.106.0",
              model: "gpt-5.3-codex",
              temperature: 0,
              modelReasoningEffort: "medium"
            },
            status: "failed"
          }
        })
      ).rejects.toThrow("Artifact write failed");
    });
  });
});
