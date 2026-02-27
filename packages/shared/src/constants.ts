export const DEFAULT_TOUR_HOME_DIR = ".tour";
export const TIMESTAMP_UTC_PATTERN = /^\d{8}-\d{6}Z$/;

export const DEFAULT_PORT = 4173;
export const DEFAULT_MODEL = "gpt-5.3-codex";
export const DEFAULT_MODEL_REASONING_EFFORT = "medium";
export const DEFAULT_MAX_DURATION_MINUTES = 45;

export const CONTEXT_VERSION = "v1";
export const PROMPT_VERSION = "tour-v1";

export const MAX_CONTEXT_FILES = 80;
export const MAX_CONTEXT_FILE_BYTES = 60_000;
export const MAX_CONTEXT_TOTAL_BYTES = 700_000;

export const JOB_STATES = [
  "queued",
  "cloning",
  "analyzing",
  "generating",
  "validating",
  "ready",
  "failed"
] as const;

export const ALLOWED_TRANSITIONS: Record<string, readonly string[]> = {
  queued: ["cloning", "failed"],
  cloning: ["analyzing", "failed"],
  analyzing: ["generating", "failed"],
  generating: ["validating", "failed"],
  validating: ["ready", "failed"],
  ready: [],
  failed: []
};

export const REQUIRED_MARKDOWN_SECTIONS = {
  setup: /(build|run|test|setup)/i,
  architecture: /(architecture|data flow|runtime flow|system map)/i,
  entryPoints: /(where to start|entry point|start here|first change|bug fix)/i
};
