import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import {
  CONTEXT_VERSION,
  MAX_CONTEXT_FILES,
  MAX_CONTEXT_FILE_BYTES,
  MAX_CONTEXT_TOTAL_BYTES,
  type ContextFile,
  type ContextManifest,
  type ResolvedRepo
} from "@tour/shared";

const EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo",
  ".cache",
  "out"
]);

const EXCLUDED_FILE_PATTERNS = [
  /package-lock\.json$/,
  /pnpm-lock\.yaml$/,
  /yarn\.lock$/,
  /bun\.lockb$/,
  /\.min\.(js|css)$/,
  /\.(png|jpg|jpeg|gif|webp|ico|pdf|zip|tar|gz|wasm|mp4|mov|avi|jar|class)$/i
];

export interface BuildContextOptions {
  maxFiles?: number;
  maxFileBytes?: number;
  maxTotalBytes?: number;
}

export async function buildContextManifest(
  repo: ResolvedRepo,
  options: BuildContextOptions = {}
): Promise<ContextManifest> {
  const maxFiles = options.maxFiles ?? MAX_CONTEXT_FILES;
  const maxFileBytes = options.maxFileBytes ?? MAX_CONTEXT_FILE_BYTES;
  const maxTotalBytes = options.maxTotalBytes ?? MAX_CONTEXT_TOTAL_BYTES;

  const relativePaths = await listRepoFiles(repo.localPath);
  const files: ContextFile[] = [];
  let totalBytes = 0;

  for (const relPath of relativePaths) {
    if (files.length >= maxFiles || totalBytes >= maxTotalBytes) {
      break;
    }

    if (EXCLUDED_FILE_PATTERNS.some((pattern) => pattern.test(relPath))) {
      continue;
    }

    const absolutePath = path.join(repo.localPath, relPath);
    const stat = await lstat(absolutePath);

    if (!stat.isFile() || stat.size > maxFileBytes) {
      continue;
    }

    const buffer = await readFile(absolutePath);
    if (isLikelyBinary(buffer)) {
      continue;
    }

    const content = buffer.toString("utf8");
    totalBytes += Buffer.byteLength(content, "utf8");

    files.push({
      path: relPath,
      sizeBytes: stat.size,
      digest: createHash("sha256").update(content).digest("hex"),
      content
    });
  }

  return {
    version: CONTEXT_VERSION,
    repo: {
      owner: repo.owner,
      repo: repo.repo,
      branch: repo.branch,
      commitSha: repo.commitSha
    },
    files
  };
}

export function serializeContextManifest(manifest: ContextManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

async function listRepoFiles(rootDir: string): Promise<string[]> {
  const collected: string[] = [];
  await walkDir(rootDir, "", collected);
  return collected.sort((a, b) => a.localeCompare(b));
}

async function walkDir(rootDir: string, relativeDir: string, collected: string[]): Promise<void> {
  const absolute = path.join(rootDir, relativeDir);
  const entries = await readdir(absolute, { withFileTypes: true });

  const sorted = entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of sorted) {
    const relPath = path.posix.join(relativeDir.replaceAll(path.sep, path.posix.sep), entry.name);

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) {
        continue;
      }

      await walkDir(rootDir, relPath, collected);
      continue;
    }

    if (entry.isFile()) {
      collected.push(relPath);
    }
  }
}

function isLikelyBinary(content: Buffer): boolean {
  const sampleLength = Math.min(content.length, 4096);
  if (sampleLength === 0) {
    return false;
  }

  let suspicious = 0;

  for (let index = 0; index < sampleLength; index += 1) {
    const byte = content[index];

    if (byte === 0) {
      return true;
    }

    if (byte < 9 || (byte > 13 && byte < 32)) {
      suspicious += 1;
    }
  }

  return suspicious / sampleLength > 0.15;
}
