export type JobState =
  | "queued"
  | "cloning"
  | "analyzing"
  | "generating"
  | "validating"
  | "ready"
  | "failed";

export interface JobStatus {
  jobId: string;
  state: JobState;
  message: string;
  createdAt: string;
  updatedAt: string;
  artifactRoot: string;
  error?: {
    phase: JobState;
    message: string;
  };
}

export interface JobLogEntry {
  timestamp: string;
  phase: JobState;
  message: string;
}

export interface GitHubRepoRef {
  owner: string;
  repo: string;
  cloneUrl: string;
  htmlUrl: string;
}

export interface ResolvedRepo extends GitHubRepoRef {
  branch: string;
  commitSha: string;
  localPath: string;
}

export interface CliOptions {
  githubUrl: string;
  branch?: string;
  port?: number;
  open: boolean;
  out?: string;
  model?: string;
  maxDurationMinutes?: number;
}

export interface RunPaths {
  root: string;
  runRoot: string;
  repoDir: string;
  slidesDir: string;
  metaDir: string;
  logsDir: string;
  logFile: string;
  slidesMarkdownPath: string;
  slidesNormalizedPath: string;
  jobMetaPath: string;
  promptPath: string;
  contextPath: string;
  modelPath: string;
}

export interface ContextFile {
  path: string;
  sizeBytes: number;
  digest: string;
  content: string;
}

export interface ContextManifest {
  version: string;
  repo: {
    owner: string;
    repo: string;
    branch: string;
    commitSha: string;
  };
  files: ContextFile[];
}

export interface PromptBundle {
  version: string;
  prompt: string;
  sha256: string;
}

export interface ModelMetadata {
  provider: "codex-sdk";
  package: "@openai/codex-sdk";
  packageVersion: string;
  model: string;
  temperature: number;
  modelReasoningEffort: "minimal" | "low" | "medium" | "high" | "xhigh";
}

export interface GenerationResult {
  markdown: string;
  usage: unknown;
  threadId: string | null;
}

export interface JobMeta {
  jobId: string;
  repo: {
    owner: string;
    repo: string;
    branch: string;
    commitSha: string;
    htmlUrl: string;
  };
  startedAt: string;
  finishedAt?: string;
  outputRoot: string;
  prompt: {
    version: string;
    sha256: string;
  };
  model: ModelMetadata;
  status: JobState;
  error?: {
    phase: JobState;
    message: string;
  };
}

export interface JobMetaResponse {
  status: JobStatus;
  meta: JobMeta | null;
}

export interface JobStatusResponse {
  status: JobStatus;
}
