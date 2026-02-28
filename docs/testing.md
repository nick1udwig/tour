# Testing

## Commands

```bash
bun run typecheck
bun run test
bun run --cwd apps/web build
```

Optional Playwright browser E2E:

```bash
PLAYWRIGHT_E2E=1 bun run test
```

## Test suites

- `tests/unit/*`
  - paths, args, state machine, context builder, prompt, markdown schema, permalink, artifacts
- `tests/integration/*`
  - repo resolver/clone, codex adapter mocked, server API, CLI orchestration mocked, reproducibility, failure paths
- `tests/e2e/*`
  - web render/export/full-flow/comment windows/overview+multi-file with Playwright (gated by `PLAYWRIGHT_E2E=1`)

## Reproducibility

`tests/integration/reproducibility.test.ts` checks:
- same repo input -> same context manifest bytes
- same context -> same prompt hash
- normalized markdown stable across line endings
