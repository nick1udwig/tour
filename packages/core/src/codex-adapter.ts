import { Codex } from "@openai/codex-sdk";

import {
  DEFAULT_MAX_DURATION_MINUTES,
  DEFAULT_MODEL,
  DEFAULT_MODEL_REASONING_EFFORT,
  type GenerationResult,
  type ModelMetadata,
  type ModelReasoningEffort
} from "@tour/shared";

const PACKAGE_VERSION = "0.106.0";

interface RunTurnResult {
  finalResponse: string;
  usage: unknown;
}

interface ThreadLike {
  id: string | null;
  run(prompt: string, options?: { signal?: AbortSignal }): Promise<RunTurnResult>;
}

interface CodexClientLike {
  startThread(options: Record<string, unknown>): ThreadLike;
}

interface GenerateWithCodexInput {
  prompt: string;
  model?: string;
  reasoningEffort?: ModelReasoningEffort;
  workingDirectory: string;
  maxDurationMinutes?: number;
}

interface GenerateWithCodexDeps {
  codexClient?: CodexClientLike;
}

export async function generateWithCodex(
  input: GenerateWithCodexInput,
  deps: GenerateWithCodexDeps = {}
): Promise<{ result: GenerationResult; model: ModelMetadata }> {
  const model = input.model ?? DEFAULT_MODEL;
  const reasoningEffort = input.reasoningEffort ?? DEFAULT_MODEL_REASONING_EFFORT;
  const maxDurationMinutes = input.maxDurationMinutes ?? DEFAULT_MAX_DURATION_MINUTES;

  const codexClient =
    deps.codexClient ??
    new Codex({
      config: {
        model_temperature: 0
      }
    });

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error(`Codex generation exceeded ${maxDurationMinutes} minutes`));
  }, maxDurationMinutes * 60_000);

  const thread = codexClient.startThread({
    model,
    workingDirectory: input.workingDirectory,
    skipGitRepoCheck: true,
    modelReasoningEffort: reasoningEffort,
    approvalPolicy: "never",
    sandboxMode: "danger-full-access",
    networkAccessEnabled: false,
    webSearchMode: "disabled"
  });

  try {
    const turn = await thread.run(input.prompt, {
      signal: controller.signal
    });

    const markdown = turn.finalResponse?.trim();
    if (!markdown) {
      throw new Error("Codex returned an empty response");
    }

    return {
      result: {
        markdown,
        usage: turn.usage,
        threadId: thread.id
      },
      model: {
        provider: "codex-sdk",
        package: "@openai/codex-sdk",
        packageVersion: PACKAGE_VERSION,
        model,
        temperature: 0,
        modelReasoningEffort: reasoningEffort
      }
    };
  } catch (error) {
    throw new Error(mapCodexError(error));
  } finally {
    clearTimeout(timeout);
  }
}

function mapCodexError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (/api[_-]?key|auth|unauthorized/i.test(message)) {
    return "Codex generation failed: authentication error. Ensure CODEX_API_KEY is set.";
  }

  if (/abort|exceeded/i.test(message)) {
    return `Codex generation failed: ${message}`;
  }

  if (/reasoning\\.effort|unsupported value/i.test(message)) {
    return `Codex generation failed: unsupported reasoning effort for selected model. Use --reasoning-effort medium (or TOUR_REASONING_EFFORT=medium), or set a compatible model. Raw error: ${message}`;
  }

  return `Codex generation failed: ${message}`;
}
