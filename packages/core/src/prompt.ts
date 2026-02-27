import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PROMPT_VERSION, type ContextManifest, type PromptBundle } from "@tour/shared";

import { sha256 } from "./utils";

interface ComposePromptInput {
  manifest: ContextManifest;
  maxDurationMinutes: number;
}

export async function composePrompt(input: ComposePromptInput): Promise<PromptBundle> {
  const templatePath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../prompts/tour-v1.txt"
  );
  const template = await readFile(templatePath, "utf8");

  const contextFiles = input.manifest.files
    .map((file) => {
      const content = file.content.length > 6_000 ? `${file.content.slice(0, 6_000)}\n// ...truncated` : file.content;
      return [
        `FILE: ${file.path}`,
        "```",
        content,
        "```"
      ].join("\n");
    })
    .join("\n\n");

  const prompt = template
    .replaceAll("{{maxDurationMinutes}}", `${input.maxDurationMinutes}`)
    .replaceAll("{{owner}}", input.manifest.repo.owner)
    .replaceAll("{{repo}}", input.manifest.repo.repo)
    .replaceAll("{{branch}}", input.manifest.repo.branch)
    .replaceAll("{{commitSha}}", input.manifest.repo.commitSha)
    .replaceAll("{{contextFiles}}", contextFiles);

  return {
    version: PROMPT_VERSION,
    prompt,
    sha256: sha256(prompt)
  };
}
