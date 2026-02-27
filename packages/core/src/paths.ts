import { homedir } from "node:os";
import path from "node:path";

import { DEFAULT_TOUR_HOME_DIR, TIMESTAMP_UTC_PATTERN, type RunPaths } from "@tour/shared";

export function formatUtcTimestamp(input = new Date()): string {
  const yyyy = `${input.getUTCFullYear()}`;
  const mm = `${input.getUTCMonth() + 1}`.padStart(2, "0");
  const dd = `${input.getUTCDate()}`.padStart(2, "0");
  const hh = `${input.getUTCHours()}`.padStart(2, "0");
  const min = `${input.getUTCMinutes()}`.padStart(2, "0");
  const ss = `${input.getUTCSeconds()}`.padStart(2, "0");
  const value = `${yyyy}${mm}${dd}-${hh}${min}${ss}Z`;

  if (!TIMESTAMP_UTC_PATTERN.test(value)) {
    throw new Error(`Failed to format UTC timestamp: ${value}`);
  }

  return value;
}

export function resolveTourRoot(explicitOut?: string, env: NodeJS.ProcessEnv = process.env): string {
  if (explicitOut) {
    return path.resolve(explicitOut);
  }

  if (env.TOUR_HOME?.trim()) {
    return path.resolve(env.TOUR_HOME.trim());
  }

  return path.resolve(path.join(homedir(), DEFAULT_TOUR_HOME_DIR));
}

interface BuildRunPathsInput {
  root: string;
  owner: string;
  repo: string;
  timestamp: string;
}

export function buildRunPaths(input: BuildRunPathsInput): RunPaths {
  const runRoot = path.normalize(
    path.resolve(input.root, input.owner, input.repo, input.timestamp)
  );

  const repoDir = path.join(runRoot, "repo");
  const slidesDir = path.join(runRoot, "slides");
  const metaDir = path.join(runRoot, "meta");
  const logsDir = path.join(runRoot, "logs");

  return {
    root: path.resolve(input.root),
    runRoot,
    repoDir,
    slidesDir,
    metaDir,
    logsDir,
    logFile: path.join(logsDir, "generation.log"),
    slidesMarkdownPath: path.join(slidesDir, "tour.md"),
    slidesNormalizedPath: path.join(slidesDir, "tour.normalized.md"),
    jobMetaPath: path.join(metaDir, "job.json"),
    promptPath: path.join(metaDir, "prompt.txt"),
    contextPath: path.join(metaDir, "context.json"),
    modelPath: path.join(metaDir, "model.json")
  };
}
