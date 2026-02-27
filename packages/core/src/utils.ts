import { createHash } from "node:crypto";

export function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function utcIsoNow(): string {
  return new Date().toISOString();
}

export function normalizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export function wordCount(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/).length;
}
