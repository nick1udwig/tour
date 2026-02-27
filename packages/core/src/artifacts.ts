import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";

import type {
  ContextManifest,
  JobMeta,
  ModelMetadata,
  RunPaths
} from "@tour/shared";

interface WriteArtifactsInput {
  paths: RunPaths;
  markdown: string;
  normalizedMarkdown: string;
  context: ContextManifest;
  prompt: {
    version: string;
    sha256: string;
    prompt: string;
  };
  model: ModelMetadata;
  meta: JobMeta;
}

export async function writeArtifacts(input: WriteArtifactsInput): Promise<void> {
  const dirs = [input.paths.runRoot, input.paths.repoDir, input.paths.slidesDir, input.paths.metaDir, input.paths.logsDir];

  try {
    for (const dir of dirs) {
      await mkdir(dir, { recursive: true });
    }

    await writeFile(input.paths.slidesMarkdownPath, input.markdown, "utf8");
    await writeFile(input.paths.slidesNormalizedPath, input.normalizedMarkdown, "utf8");
    await writeFile(input.paths.contextPath, `${JSON.stringify(input.context, null, 2)}\n`, "utf8");
    await writeFile(input.paths.promptPath, input.prompt.prompt, "utf8");
    await writeFile(input.paths.modelPath, `${JSON.stringify(input.model, null, 2)}\n`, "utf8");
    await writeFile(input.paths.jobMetaPath, `${JSON.stringify(input.meta, null, 2)}\n`, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Artifact write failed: ${message}`);
  }
}

export async function appendGenerationLog(paths: RunPaths, line: string): Promise<void> {
  await mkdir(paths.logsDir, { recursive: true });
  await appendFile(paths.logFile, `${line}\n`, "utf8");
}

export async function readMarkdownArtifact(paths: RunPaths): Promise<string> {
  return readFile(paths.slidesMarkdownPath, "utf8");
}
