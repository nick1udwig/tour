# Sample Repo Orientation
This fixture repository demonstrates deterministic tour generation for tests.

## Architecture map
- `src/index.ts` exports simple utility functions.
- No framework runtime, pure TypeScript module.

```ts path=src/index.ts lines=1-6 highlight=1,5 permalink=https://github.com/example/sample/blob/abc123/src/index.ts#L1-L6
export function greet(name: string): string {
  return `hello ${name}`;
}

export function add(a: number, b: number): number {
  return a + b;
}
```

---
# Build and run setup
- Install dependencies with `bun install`.
- Run tests with `bun run test`.
- Run type checks with `bun run typecheck`.

---
# Where to start
- Feature entry point: extend `src/index.ts` exports.
- Bug-fix path: add a regression test under `tests/` first, then patch implementation.
