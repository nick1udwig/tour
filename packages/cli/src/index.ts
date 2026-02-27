#!/usr/bin/env bun

import { parseCliArgs } from "./args";
import { orchestrateTour } from "./orchestrator";

async function main(): Promise<void> {
  const parsed = parseCliArgs(process.argv.slice(2));

  if (!parsed.ok || !parsed.options) {
    if (parsed.error) {
      console.error(parsed.error);
    }
    console.log(parsed.helpText);
    process.exit(parsed.error ? 1 : 0);
  }

  const result = await orchestrateTour(parsed.options);
  process.exit(result.exitCode);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
