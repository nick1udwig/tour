# Architecture

## Packages

- `packages/cli`: argument parsing + orchestration.
- `packages/core`: repo clone/resolve, deterministic context, prompt build, Codex adapter, markdown validation/normalize, artifact writes.
- `packages/server`: job state machine + local HTTP API/static serving.
- `packages/shared`: shared types/constants.
- `apps/web`: Vite deck renderer (spinner, navigation, code snippet highlights, exports).

## Request flow

1. CLI parses `tour <github-url>` and resolves output root.
2. Local server starts immediately and prints URL with `jobId` query parameter.
3. Orchestrator transitions job phases:
   - `queued -> cloning -> analyzing -> generating -> validating -> ready|failed`
4. Core writes artifacts/logs on both success and failure.
5. Web polls `/api/jobs/:jobId/status` until `ready` or `failed`.
6. On `ready`, web fetches `/api/jobs/:jobId/slides.md` and renders deck.

## Determinism controls

- Stable file walk and sort order.
- Exclusion rules for binaries/generated files.
- Prompt template versioned (`tour-v1`) and hash recorded.
- Codex adapter uses deterministic settings contract (`temperature=0`, `modelReasoningEffort=minimal`).
- Markdown normalization persisted (`tour.normalized.md`).
