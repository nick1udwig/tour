import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  appendGenerationLog,
  assertMarkdownContract,
  buildContextManifest,
  buildRunPaths,
  cloneRepository,
  composePrompt,
  formatUtcTimestamp,
  generateWithCodex,
  normalizeMarkdown,
  parseGitHubRepoUrl,
  resolveTourRoot,
  serializeContextManifest,
  writeArtifacts
} from "@tour/core";
import { InMemoryJobStore, startTourServer } from "@tour/server";
import {
  DEFAULT_MAX_DURATION_MINUTES,
  type CliOptions,
  type JobMeta,
  type ModelMetadata
} from "@tour/shared";

interface OrchestrateDeps {
  cloneRepository?: typeof cloneRepository;
  buildContextManifest?: typeof buildContextManifest;
  composePrompt?: typeof composePrompt;
  generateWithCodex?: typeof generateWithCodex;
  normalizeMarkdown?: typeof normalizeMarkdown;
  assertMarkdownContract?: typeof assertMarkdownContract;
  writeArtifacts?: typeof writeArtifacts;
  appendGenerationLog?: typeof appendGenerationLog;
  startTourServer?: typeof startTourServer;
}

export interface OrchestrateResult {
  exitCode: number;
  url: string;
  jobId: string;
  runRoot: string;
}

export async function orchestrateTour(
  options: CliOptions,
  deps: OrchestrateDeps = {}
): Promise<OrchestrateResult> {
  const cloneRepositoryFn = deps.cloneRepository ?? cloneRepository;
  const buildContextManifestFn = deps.buildContextManifest ?? buildContextManifest;
  const composePromptFn = deps.composePrompt ?? composePrompt;
  const generateWithCodexFn = deps.generateWithCodex ?? generateWithCodex;
  const normalizeMarkdownFn = deps.normalizeMarkdown ?? normalizeMarkdown;
  const assertMarkdownContractFn = deps.assertMarkdownContract ?? assertMarkdownContract;
  const writeArtifactsFn = deps.writeArtifacts ?? writeArtifacts;
  const appendGenerationLogFn = deps.appendGenerationLog ?? appendGenerationLog;
  const startTourServerFn = deps.startTourServer ?? startTourServer;

  const repoRef = parseGitHubRepoUrl(options.githubUrl);
  const timestamp = formatUtcTimestamp();
  const root = resolveTourRoot(options.out);
  const paths = buildRunPaths({
    root,
    owner: repoRef.owner,
    repo: repoRef.repo,
    timestamp
  });

  const jobId = `${repoRef.owner}-${repoRef.repo}-${timestamp}`;
  const jobStore = new InMemoryJobStore();
  jobStore.create(jobId, paths.runRoot);

  const staticDir = await resolveStaticDir();
  const server = await startTourServerFn({
    jobStore,
    staticDir,
    port: options.port
  });

  const deckUrl = `${server.url}/?jobId=${encodeURIComponent(jobId)}`;
  console.log(`Tour URL: ${deckUrl}`);

  if (options.open) {
    await attemptOpenBrowser(deckUrl);
  }

  let exitCode = 0;
  let modelMeta: ModelMetadata | null = null;
  let promptMeta: { version: string; sha256: string } | null = null;

  try {
    jobStore.transition(jobId, "cloning", "Cloning repository");
    await appendGenerationLogFn(paths, `[cloning] ${new Date().toISOString()} cloning ${repoRef.htmlUrl}`);

    const resolvedRepo = await cloneRepositoryFn({
      repo: repoRef,
      branch: options.branch,
      targetDir: paths.repoDir
    });

    jobStore.transition(jobId, "analyzing", "Building deterministic context");
    await appendGenerationLogFn(
      paths,
      `[analyzing] ${new Date().toISOString()} branch=${resolvedRepo.branch} sha=${resolvedRepo.commitSha}`
    );

    const context = await buildContextManifestFn(resolvedRepo);
    const prompt = await composePromptFn({
      manifest: context,
      maxDurationMinutes: options.maxDurationMinutes ?? DEFAULT_MAX_DURATION_MINUTES
    });

    promptMeta = {
      version: prompt.version,
      sha256: prompt.sha256
    };

    await appendGenerationLogFn(
      paths,
      `[analyzing] ${new Date().toISOString()} files=${context.files.length} context_sha=${serializeContextManifest(context).length}`
    );

    jobStore.transition(jobId, "generating", "Generating tour markdown with Codex");

    const generated = await generateWithCodexFn({
      prompt: prompt.prompt,
      model: options.model,
      workingDirectory: paths.repoDir,
      maxDurationMinutes: options.maxDurationMinutes
    });

    modelMeta = generated.model;

    jobStore.transition(jobId, "validating", "Validating markdown contract");
    assertMarkdownContractFn(generated.result.markdown);
    const normalized = normalizeMarkdownFn(generated.result.markdown);

    const meta: JobMeta = {
      jobId,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      outputRoot: paths.runRoot,
      repo: {
        owner: resolvedRepo.owner,
        repo: resolvedRepo.repo,
        branch: resolvedRepo.branch,
        commitSha: resolvedRepo.commitSha,
        htmlUrl: resolvedRepo.htmlUrl
      },
      prompt: {
        version: prompt.version,
        sha256: prompt.sha256
      },
      model: generated.model,
      status: "ready"
    };

    await writeArtifactsFn({
      paths,
      markdown: generated.result.markdown,
      normalizedMarkdown: normalized,
      context,
      prompt,
      model: generated.model,
      meta
    });

    jobStore.transition(jobId, "ready", "Tour ready");
    await appendGenerationLogFn(paths, `[ready] ${new Date().toISOString()} markdown_bytes=${generated.result.markdown.length}`);
  } catch (error) {
    exitCode = 1;
    const message = error instanceof Error ? error.message : String(error);
    const phase = jobStore.getStatus(jobId)?.state ?? "failed";
    jobStore.fail(jobId, phase, message);
    await appendGenerationLogFn(paths, `[failed] ${new Date().toISOString()} ${message}`);

    const fallbackMeta: JobMeta = {
      jobId,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      outputRoot: paths.runRoot,
      repo: {
        owner: repoRef.owner,
        repo: repoRef.repo,
        branch: options.branch ?? "unknown",
        commitSha: "unknown",
        htmlUrl: repoRef.htmlUrl
      },
      prompt: promptMeta ?? {
        version: "unknown",
        sha256: "unknown"
      },
      model:
        modelMeta ??
        {
          provider: "codex-sdk",
          package: "@openai/codex-sdk",
          packageVersion: "0.106.0",
          model: options.model ?? "unknown",
          temperature: 0,
          modelReasoningEffort: "minimal"
        },
      status: "failed",
      error: {
        phase,
        message
      }
    };

    try {
      await writeArtifactsFn({
        paths,
        markdown: "",
        normalizedMarkdown: "",
        context: {
          version: "v1",
          repo: {
            owner: repoRef.owner,
            repo: repoRef.repo,
            branch: options.branch ?? "unknown",
            commitSha: "unknown"
          },
          files: []
        },
        prompt: {
          version: fallbackMeta.prompt.version,
          sha256: fallbackMeta.prompt.sha256,
          prompt: ""
        },
        model: fallbackMeta.model,
        meta: fallbackMeta
      });
    } catch {
      // ignore nested failure, logs already preserved
    }

    console.error(`Tour generation failed. See logs: ${paths.logFile}`);
    console.error(message);
  }

  if (!shouldKeepAlive()) {
    await server.close();
    return {
      exitCode,
      url: deckUrl,
      jobId,
      runRoot: paths.runRoot
    };
  }

  console.log("Server running. Press Ctrl+C to exit.");
  await new Promise<void>((resolve) => {
    process.once("SIGINT", () => resolve());
    process.once("SIGTERM", () => resolve());
  });

  await server.close();

  return {
    exitCode,
    url: deckUrl,
    jobId,
    runRoot: paths.runRoot
  };
}

async function resolveStaticDir(): Promise<string> {
  const baseDir = path.dirname(fileURLToPath(import.meta.url));
  const distDir = path.resolve(baseDir, "../../../apps/web/dist");
  try {
    await access(distDir);
    return distDir;
  } catch {
    return path.resolve(baseDir, "../../../apps/web");
  }
}

function shouldKeepAlive(): boolean {
  if (process.env.TOUR_NO_KEEPALIVE === "1") {
    return false;
  }

  return Boolean(process.stdout.isTTY);
}

async function attemptOpenBrowser(url: string): Promise<void> {
  const { spawn } = await import("node:child_process");

  const commands: Array<{ command: string; args: string[] }> = process.platform === "darwin"
    ? [{ command: "open", args: [url] }]
    : process.platform === "win32"
    ? [{ command: "cmd", args: ["/c", "start", "", url] }]
    : [{ command: "xdg-open", args: [url] }];

  for (const entry of commands) {
    try {
      await new Promise<void>((resolve, reject) => {
        const child = spawn(entry.command, entry.args, { stdio: "ignore", detached: true });
        child.once("error", reject);
        child.once("spawn", () => {
          child.unref();
          resolve();
        });
      });
      return;
    } catch {
      // try next opener
    }
  }
}
