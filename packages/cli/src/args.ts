import type { CliOptions, ModelReasoningEffort } from "@tour/shared";

import { parseGitHubRepoUrl } from "@tour/core";

export interface ParsedArgsResult {
  ok: boolean;
  options?: CliOptions;
  error?: string;
  helpText: string;
}

export function parseCliArgs(argv: string[], env: NodeJS.ProcessEnv = process.env): ParsedArgsResult {
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
  const envReasoningEffort = parseReasoningEffort(env.TOUR_REASONING_EFFORT);
  if (env.TOUR_REASONING_EFFORT && !envReasoningEffort) {
    return {
      ok: false,
      helpText,
      error: `Invalid TOUR_REASONING_EFFORT value: ${env.TOUR_REASONING_EFFORT}`
    };
  }

  const options: CliOptions = {
    githubUrl: "",
    open: false,
    model: env.TOUR_MODEL?.trim() || undefined,
    reasoningEffort: envReasoningEffort ?? undefined
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

    if (token === "--reasoning-effort") {
      const value = parseReasoningEffort(next);
      if (!value) {
        return {
          ok: false,
          helpText,
          error: `Invalid --reasoning-effort value: ${next}`
        };
      }

      options.reasoningEffort = value;
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
    "  tour <github-url> [--branch <branch>] [--port <n>] [--open] [--out <path>] [--model <id>] [--reasoning-effort <minimal|low|medium|high|xhigh>] [--max-duration <minutes>]",
    "",
    "Examples:",
    "  tour https://github.com/nick1udwig/tour",
    "  tour https://github.com/nick1udwig/tour --branch main --port 4173 --model gpt-5.3-codex --reasoning-effort medium --open"
  ].join("\n");
}

function parseReasoningEffort(input: string | undefined): ModelReasoningEffort | null {
  if (!input) {
    return null;
  }

  const value = input.trim().toLowerCase();
  if (value === "minimal" || value === "low" || value === "medium" || value === "high" || value === "xhigh") {
    return value;
  }

  return null;
}
