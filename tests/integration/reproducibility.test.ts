import { cp } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "bun:test";

import {
  buildContextManifest,
  composePrompt,
  normalizeMarkdown,
  serializeContextManifest
} from "@tour/core";

import { withTempDir } from "../helpers";

describe("reproducibility", () => {
  it("produces byte-identical normalized output for same inputs", async () => {
    await withTempDir(async (tempDir) => {
      const source = path.resolve(import.meta.dirname, "../fixtures/sample-repo");
      const repoDir = path.join(tempDir, "repo");
      await cp(source, repoDir, { recursive: true });

      const repo = {
        owner: "fixture",
        repo: "sample-repo",
        branch: "main",
        commitSha: "abc123",
        localPath: repoDir,
        cloneUrl: "",
        htmlUrl: ""
      };

      const contextOne = await buildContextManifest(repo);
      const contextTwo = await buildContextManifest(repo);

      const serializedOne = serializeContextManifest(contextOne);
      const serializedTwo = serializeContextManifest(contextTwo);

      expect(serializedOne).toBe(serializedTwo);

      const promptOne = await composePrompt({ manifest: contextOne, maxDurationMinutes: 45 });
      const promptTwo = await composePrompt({ manifest: contextTwo, maxDurationMinutes: 45 });
      expect(promptOne.sha256).toBe(promptTwo.sha256);

      const markdownOne = normalizeMarkdown("# Architecture\r\n\r\nSetup and run\r\n\r\nWhere to start\r\n");
      const markdownTwo = normalizeMarkdown("# Architecture\n\nSetup and run\n\nWhere to start\n");
      expect(markdownOne).toBe(markdownTwo);
    });
  });
});
