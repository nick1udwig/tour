# Codebase Tour Tool MVP - Full Implementation Plan

Date: 2026-02-27  
Status: Approved scope for implementation

## 1) Product Goal

Build an MVP CLI + local web app that turns a public GitHub repository into a slide-deck walkthrough.

Primary outcome:
- A new engineer can get a practical high-level understanding of the codebase in under one hour.
- They can identify where to start for feature work or bug fixes.
- They can also get build/run/test/deploy instructions from the same tour.

## 2) Scope and Constraints

In scope:
- Public GitHub repos only.
- CLI command: `tour <github-url> [--branch <branch>]`.
- If `--branch` is omitted, use repository default branch.
- Generation backend uses Codex SDK.
- Frontend and backend are TypeScript.
- Frontend uses Vite.
- Slides are generated as Markdown, then rendered by a prebuilt slide deck site.
- UI supports export to Markdown and PDF.
- Reproducibility/determinism is required.
- Ship demo + tests + build/run docs.

Out of scope (MVP):
- Interactive "ask questions during tour" mode.
- Private repository auth flow.
- Multi-user hosted service.

## 3) User Experience

Command:
- `tour https://github.com/<owner>/<repo>`
- Optional: `--branch <name>`

Runtime behavior:
1. CLI validates input URL and resolves clone target.
2. Repo is cloned and pinned to a commit SHA.
3. CLI starts generation job and local server.
4. CLI prints local URL immediately.
5. If page opens before generation finishes, frontend shows loading spinner.
6. When ready, deck loads with code snippets, highlights, commentary, and GitHub permalinks.
7. User can export Markdown and PDF.

## 4) Artifact and Storage Design

Storage root:
- Default: `~/.tour`
- Override: `TOUR_HOME`

Output directory format:
- `<tour-root>/<owner>/<repo>/<timestamp>/`
- Timestamp format: `YYYYMMDD-HHmmssZ` (UTC)

Example:
- `~/.tour/vercel/next.js/20260227-184500Z/`

Artifact layout:
- `repo/` cloned repository snapshot
- `slides/tour.md` generated slide Markdown
- `slides/tour.normalized.md` optional normalized output for deterministic comparisons
- `meta/job.json` run metadata
- `meta/prompt.txt` exact prompt sent to model
- `meta/context.json` deterministic context manifest
- `meta/model.json` model + settings used
- `logs/generation.log`

## 5) Proposed Repository Structure

Monorepo with Bun workspaces:

```text
.
├── apps/
│   └── web/                  # Vite + TS slide renderer
├── packages/
│   ├── cli/                  # `tour` command entrypoint and orchestration
│   ├── core/                 # analysis, context building, prompting, markdown schema
│   ├── server/               # local HTTP API + static asset serving
│   └── shared/               # shared TS types/constants
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── fixtures/
└── docs/
```

## 6) System Architecture

Core components:
- CLI Orchestrator (`packages/cli`)
- Repo Fetch + Resolver (`packages/core`)
- Deterministic Context Builder (`packages/core`)
- Codex Generation Adapter (`packages/core`)
- Markdown Validator/Normalizer (`packages/core`)
- Local Server (`packages/server`)
- Deck UI (`apps/web`)

Data flow:
1. CLI parses args and starts a `jobId`.
2. Repo fetched to artifact directory.
3. Branch resolved to commit SHA.
4. Context builder selects and serializes deterministic inputs.
5. Prompt composer builds versioned prompt.
6. Codex adapter generates markdown deck.
7. Markdown validator enforces schema constraints.
8. Server exposes job status and deck artifacts.
9. UI polls status and renders deck when complete.

## 7) CLI Specification

Base command:
- `tour <github-url>`

Flags:
- `--branch <name>` use explicit branch; default repo default branch
- `--port <n>` local server port, default auto
- `--open` open browser automatically (default false)
- `--out <path>` optional direct output root override (still below owner/repo/timestamp)
- `--model <id>` optional pinned model override
- `--max-duration <minutes>` cap generation effort

Exit behavior:
- Non-zero on validation/fetch/generation/schema failure.
- On failure, leave artifacts/logs in place for debugging.

## 8) Deterministic Generation Strategy

Deterministic inputs:
- Fixed file selection algorithm and stable sort order.
- Explicit include/exclude rules (lockfile, build artifacts, binaries excluded).
- File content captured at pinned commit SHA.
- Prompt template versioned in repo.

Deterministic model invocation:
- Temperature `0`.
- Fixed top-p / other sampling controls.
- Pinned model identifier/version.
- Seed value if SDK supports it.

Deterministic outputs:
- Normalize line endings and whitespace in generated markdown.
- Normalize section ordering where applicable.
- Persist prompt + context + model settings for replay.

## 9) Markdown Slide Contract

Required high-level sections (adaptive number of slides):
- Repository orientation and architecture map
- Runtime and data flow walkthrough
- Key modules/components and responsibilities
- Build/run/test workflow
- Deployment path (if inferable)
- "Where to start" guidance for feature work and bug fixing

Per-slide requirements:
- Slide title
- Concise commentary
- Optional code block with:
  - repo-relative path
  - line range metadata
  - highlight lines
  - GitHub permalink using exact commit SHA

Validation rules:
- Must include at least one pragmatic setup slide.
- Must include at least one architecture/data-flow slide.
- Must include at least one "entry point for changes" slide.
- Estimated read/view duration <= 60 minutes.

## 10) Frontend Plan (Vite + TS)

UI features:
- Loading state while generation is running.
- Slide navigation (keyboard + click).
- Code viewer with syntax highlighting and highlighted lines.
- GitHub permalink buttons per snippet.
- Export buttons:
  - Save Markdown
  - Save PDF (print-optimized deck style via browser print)

Technical approach:
- Markdown parser + custom slide renderer.
- Light client-side state for current slide and job polling.
- Print stylesheet tuned for clean PDF export.

## 11) Local Server Plan (TS)

Endpoints:
- `GET /api/jobs/:jobId/status`
- `GET /api/jobs/:jobId/slides.md`
- `GET /api/jobs/:jobId/meta`
- Static serving for Vite build assets

Status model:
- `queued | cloning | analyzing | generating | validating | ready | failed`
- Include progress message + error details if failed.

## 12) GitHub Linking Rules

For each code snippet:
- Build permalink as:
  - `https://github.com/<owner>/<repo>/blob/<sha>/<path>#Lx-Ly`
- If line range invalid, degrade gracefully to file-level link at commit SHA.

## 13) Testing Strategy

Unit tests:
- URL and branch parsing
- Output path resolution with `TOUR_HOME`
- Deterministic context selection ordering
- Prompt assembly and template versioning
- Markdown schema validator
- GitHub permalink generation

Integration tests:
- End-to-end job orchestration with mocked Codex SDK output
- Failure-path handling and retained logs
- Spinner state until ready

E2E tests:
- Run local server, load deck, navigate slides
- Verify code highlights and links
- Verify Save Markdown and Save PDF actions

Reproducibility tests:
- Same fixture input + same settings -> byte-identical normalized output

## 14) Observability and Debuggability

Per-job logs:
- Phase transitions and durations
- Selected files count/size
- Model request/response metadata (no secrets)
- Validation results

Failure diagnostics:
- Preserve partial artifacts and exact failure phase
- Emit actionable CLI error summary plus path to log directory

## 15) Security and Safety Notes

MVP assumptions:
- Public repositories only.
- Local execution only.

Guardrails:
- Enforce clone depth if needed to limit runtime.
- Ignore binary/large generated files in context build.
- Bound max analyzed file count and token budget.

## 16) Milestones

M1 - Scaffold and foundations:
- Bun workspace, package structure, shared types, lint/test setup.

M2 - Core pipeline:
- CLI args, clone/branch/sha resolution, artifact pathing, status lifecycle.

M3 - Generation:
- Context builder, Codex SDK adapter, markdown validator, artifact writing.

M4 - Web UX:
- Vite deck renderer, loading spinner, code/highlight rendering, exports.

M5 - Quality and docs:
- Unit/integration/E2E tests, reproducibility suite, README + developer docs.

## 17) Definition of Done (MVP)

MVP is complete when all are true:
- `tour <public-github-url>` works end-to-end locally.
- `--branch` works and default branch fallback works.
- Output lands under `TOUR_HOME` or `~/.tour` path convention.
- Generated deck includes architecture + practical setup/run/test guidance.
- UI shows spinner during generation and renders deck on completion.
- Markdown and PDF export both work.
- Tests cover core logic and end-to-end happy path + failure path.
- Documentation explains install, run, test, and architecture.

## 18) Immediate Execution Order

1. Initialize Bun monorepo and package skeleton.
2. Implement output pathing and job lifecycle primitives.
3. Implement deterministic context builder + prompt composer.
4. Integrate Codex SDK generation and markdown validation.
5. Build web renderer and export actions.
6. Add integration/E2E tests and finalize docs.
