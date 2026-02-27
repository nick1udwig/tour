import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

import { describe, expect, it } from "bun:test";

import { cloneRepository, parseGitHubRepoUrl, resolveDefaultBranch } from "@tour/core";

import { withTempDir } from "../helpers";

const execFileAsync = promisify(execFile);

describe("repo resolver and clone", () => {
  it("parses owner/repo from github URL", () => {
    const parsed = parseGitHubRepoUrl("https://github.com/openai/codex");
    expect(parsed.owner).toBe("openai");
    expect(parsed.repo).toBe("codex");
  });

  it("falls back to default branch and captures commit sha", async () => {
    await withTempDir(async (tempDir) => {
      const remote = path.join(tempDir, "remote.git");
      const seed = path.join(tempDir, "seed");
      const clone = path.join(tempDir, "clone");

      await execFileAsync("git", ["init", "--bare", remote]);
      await execFileAsync("git", ["init", seed]);
      await execFileAsync("git", ["-C", seed, "config", "user.email", "test@example.com"]);
      await execFileAsync("git", ["-C", seed, "config", "user.name", "Test User"]);
      await Bun.write(path.join(seed, "README.md"), "# fixture\n");
      await execFileAsync("git", ["-C", seed, "add", "README.md"]);
      await execFileAsync("git", ["-C", seed, "commit", "-m", "init"]);
      await execFileAsync("git", ["-C", seed, "branch", "-M", "main"]);
      await execFileAsync("git", ["-C", seed, "remote", "add", "origin", remote]);
      await execFileAsync("git", ["-C", seed, "push", "-u", "origin", "main"]);
      await execFileAsync("git", ["-C", remote, "symbolic-ref", "HEAD", "refs/heads/main"]);

      const repo = {
        owner: "fixture",
        repo: "sample",
        cloneUrl: remote,
        htmlUrl: "https://github.com/fixture/sample"
      };

      const branch = await resolveDefaultBranch(repo);
      expect(branch).toBe("main");

      const resolved = await cloneRepository({
        repo,
        targetDir: clone
      });

      const { stdout } = await execFileAsync("git", ["-C", seed, "rev-parse", "HEAD"]);
      expect(resolved.branch).toBe("main");
      expect(resolved.commitSha).toBe(stdout.trim());
    });
  });

  it("fails clearly on unknown branch", async () => {
    await withTempDir(async (tempDir) => {
      const remote = path.join(tempDir, "remote.git");
      const seed = path.join(tempDir, "seed");
      const clone = path.join(tempDir, "clone");

      await execFileAsync("git", ["init", "--bare", remote]);
      await execFileAsync("git", ["init", seed]);
      await execFileAsync("git", ["-C", seed, "config", "user.email", "test@example.com"]);
      await execFileAsync("git", ["-C", seed, "config", "user.name", "Test User"]);
      await Bun.write(path.join(seed, "README.md"), "# fixture\n");
      await execFileAsync("git", ["-C", seed, "add", "README.md"]);
      await execFileAsync("git", ["-C", seed, "commit", "-m", "init"]);
      await execFileAsync("git", ["-C", seed, "branch", "-M", "main"]);
      await execFileAsync("git", ["-C", seed, "remote", "add", "origin", remote]);
      await execFileAsync("git", ["-C", seed, "push", "-u", "origin", "main"]);
      await execFileAsync("git", ["-C", remote, "symbolic-ref", "HEAD", "refs/heads/main"]);

      const repo = {
        owner: "fixture",
        repo: "sample",
        cloneUrl: remote,
        htmlUrl: "https://github.com/fixture/sample"
      };

      await expect(
        cloneRepository({
          repo,
          branch: "does-not-exist",
          targetDir: clone
        })
      ).rejects.toThrow("does-not-exist");
    });
  });
});
