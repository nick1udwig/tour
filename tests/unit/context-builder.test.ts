import { cp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "bun:test";

import { buildContextManifest, serializeContextManifest } from "@tour/core";

import { withTempDir } from "../helpers";

describe("context builder", () => {
  it("is deterministic and excludes binary/generated files", async () => {
    await withTempDir(async (tempDir) => {
      const fixtureSource = path.resolve(import.meta.dirname, "../fixtures/sample-repo");
      const repoDir = path.join(tempDir, "repo");
      await cp(fixtureSource, repoDir, { recursive: true });

      await mkdir(path.join(repoDir, "node_modules"), { recursive: true });
      await writeFile(path.join(repoDir, "node_modules", "ignored.js"), "console.log('ignored');\n", "utf8");
      await writeFile(path.join(repoDir, "image.png"), Buffer.from([0, 1, 2, 3, 4]));
      await writeFile(path.join(repoDir, "bun.lockb"), "lock data", "utf8");

      const repo = {
        owner: "fixture",
        repo: "sample-repo",
        branch: "main",
        commitSha: "abc123",
        localPath: repoDir,
        cloneUrl: "",
        htmlUrl: ""
      };

      const first = await buildContextManifest(repo);
      const second = await buildContextManifest(repo);

      const firstSerialized = serializeContextManifest(first);
      const secondSerialized = serializeContextManifest(second);

      expect(firstSerialized).toBe(secondSerialized);
      expect(first.files.some((file) => file.path.includes("node_modules"))).toBeFalse();
      expect(first.files.some((file) => file.path.endsWith("bun.lockb"))).toBeFalse();
      expect(first.files.some((file) => file.path.endsWith("image.png"))).toBeFalse();
    });
  });
});
