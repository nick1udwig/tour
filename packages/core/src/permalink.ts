interface BuildPermalinkInput {
  owner: string;
  repo: string;
  sha: string;
  path: string;
  startLine?: number;
  endLine?: number;
}

export function buildGitHubPermalink(input: BuildPermalinkInput): string {
  const base = `https://github.com/${input.owner}/${input.repo}/blob/${input.sha}/${trimLeadingSlash(
    input.path
  )}`;

  if (!isValidLine(input.startLine)) {
    return base;
  }

  const startLine = input.startLine as number;
  if (!isValidLine(input.endLine) || (input.endLine as number) < startLine) {
    return `${base}#L${startLine}`;
  }

  return `${base}#L${startLine}-L${input.endLine as number}`;
}

function isValidLine(value: number | undefined): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function trimLeadingSlash(value: string): string {
  return value.replace(/^\/+/, "");
}
