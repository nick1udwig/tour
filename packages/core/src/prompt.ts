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
  const packageDir = path.dirname(fileURLToPath(import.meta.url));
  const templatePath = path.resolve(packageDir, "../prompts/tour-v1.txt");
  const webMarkdownParserPath = path.resolve(packageDir, "../../../apps/web/src/markdown.ts");

  const [template, webMarkdownParserSource] = await Promise.all([
    readFile(templatePath, "utf8"),
    readFile(webMarkdownParserPath, "utf8")
  ]);

  const templateVars = new Map<string, string>([
    ["maxDurationMinutes", `${input.maxDurationMinutes}`],
    ["owner", input.manifest.repo.owner],
    ["repo", input.manifest.repo.repo],
    ["branch", input.manifest.repo.branch],
    ["commitSha", input.manifest.repo.commitSha],
    ["webMarkdownParserSource", webMarkdownParserSource.trimEnd()]
  ]);

  let prompt = template;
  for (const [key, value] of templateVars) {
    prompt = prompt.replaceAll(`{{${key}}}`, value);
  }

  return {
    version: PROMPT_VERSION,
    prompt,
    sha256: sha256(prompt)
  };
}
