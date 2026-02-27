import { execFile } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { promisify } from "node:util";

import type { GitHubRepoRef, ResolvedRepo } from "@tour/shared";

const execFileAsync = promisify(execFile);
const OWNER_REPO_RE = /^[A-Za-z0-9_.-]+$/;

export function parseGitHubRepoUrl(input: string): GitHubRepoRef {
  let url: URL;

  try {
    url = new URL(input);
  } catch {
    throw new Error(`Invalid URL: ${input}`);
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only http(s) GitHub URLs are supported");
  }

  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
    throw new Error("Only github.com repositories are supported in MVP");
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 2) {
    throw new Error("Expected URL format: https://github.com/<owner>/<repo>");
  }

  const owner = segments[0];
  const repo = segments[1].replace(/\.git$/i, "");

  if (!OWNER_REPO_RE.test(owner) || !OWNER_REPO_RE.test(repo)) {
    throw new Error("Repository owner/repo contains unsupported characters");
  }

  return {
    owner,
    repo,
    cloneUrl: `https://github.com/${owner}/${repo}.git`,
    htmlUrl: `https://github.com/${owner}/${repo}`
  };
}

export async function resolveDefaultBranch(repo: GitHubRepoRef): Promise<string> {
  const { stdout } = await execFileAsync("git", ["ls-remote", "--symref", repo.cloneUrl, "HEAD"]);

  const line = stdout
    .split("\n")
    .find((candidate) => candidate.startsWith("ref: refs/heads/"));

  if (!line) {
    throw new Error(`Could not resolve default branch for ${repo.htmlUrl}`);
  }

  return line.replace("ref: refs/heads/", "").split("\t")[0].trim();
}

interface CloneRepositoryInput {
  repo: GitHubRepoRef;
  branch?: string;
  targetDir: string;
}

export async function cloneRepository(input: CloneRepositoryInput): Promise<ResolvedRepo> {
  const branch = input.branch ?? (await resolveDefaultBranch(input.repo));

  await rm(input.targetDir, { recursive: true, force: true });
  await mkdir(input.targetDir, { recursive: true });

  try {
    await execFileAsync("git", [
      "clone",
      "--depth=1",
      "--single-branch",
      "--branch",
      branch,
      input.repo.cloneUrl,
      input.targetDir
    ]);
  } catch (error) {
    const message = extractExecErrorMessage(error);
    if (/Remote branch .* not found in upstream origin/i.test(message)) {
      throw new Error(`Branch \"${branch}\" was not found in ${input.repo.htmlUrl}`);
    }

    throw new Error(`Clone failed for ${input.repo.htmlUrl}: ${message}`);
  }

  const { stdout } = await execFileAsync("git", ["-C", input.targetDir, "rev-parse", "HEAD"]);
  const commitSha = stdout.trim();

  if (!commitSha) {
    throw new Error("Failed to resolve cloned commit SHA");
  }

  return {
    ...input.repo,
    branch,
    commitSha,
    localPath: input.targetDir
  };
}

function extractExecErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const payload = error as Error & { stderr?: string; stdout?: string };
  return payload.stderr?.trim() || payload.stdout?.trim() || error.message;
}
