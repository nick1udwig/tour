import type { CliOptions } from "@tour/shared";

import { parseGitHubRepoUrl } from "@tour/core";

export interface ParsedArgsResult {
  ok: boolean;
  options?: CliOptions;
  error?: string;
  helpText: string;
}

export function parseCliArgs(argv: string[]): ParsedArgsResult {
  const helpText = buildHelpText();
  const args = [...argv];

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    return {
      ok: false,
      helpText,
      error: args.length === 0 ? "Missing GitHub URL" : undefined
    };
  }

  const positionals: string[] = [];
  const options: CliOptions = {
    githubUrl: "",
    open: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }

    if (token === "--open") {
      options.open = true;
      continue;
    }

    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      return {
        ok: false,
        helpText,
        error: `Missing value for ${token}`
      };
    }

    if (token === "--branch") {
      options.branch = next;
      index += 1;
      continue;
    }

    if (token === "--port") {
      const value = Number(next);
      if (!Number.isInteger(value) || value <= 0) {
        return {
          ok: false,
          helpText,
          error: `Invalid --port value: ${next}`
        };
      }

      options.port = value;
      index += 1;
      continue;
    }

    if (token === "--out") {
      options.out = next;
      index += 1;
      continue;
    }

    if (token === "--model") {
      options.model = next;
      index += 1;
      continue;
    }

    if (token === "--max-duration") {
      const value = Number(next);
      if (!Number.isFinite(value) || value <= 0) {
        return {
          ok: false,
          helpText,
          error: `Invalid --max-duration value: ${next}`
        };
      }

      options.maxDurationMinutes = value;
      index += 1;
      continue;
    }

    return {
      ok: false,
      helpText,
      error: `Unknown flag: ${token}`
    };
  }

  if (positionals.length === 0) {
    return {
      ok: false,
      helpText,
      error: "Missing GitHub URL"
    };
  }

  options.githubUrl = positionals[0];

  try {
    parseGitHubRepoUrl(options.githubUrl);
  } catch (error) {
    return {
      ok: false,
      helpText,
      error: error instanceof Error ? error.message : String(error)
    };
  }

  return {
    ok: true,
    options,
    helpText
  };
}

function buildHelpText(): string {
  return [
    "Usage:",
    "  tour <github-url> [--branch <branch>] [--port <n>] [--open] [--out <path>] [--model <id>] [--max-duration <minutes>]",
    "",
    "Examples:",
    "  tour https://github.com/openai/codex",
    "  tour https://github.com/openai/codex --branch main --port 4173 --open"
  ].join("\n");
}
