export function normalizeMarkdown(markdown: string): string {
  const normalizedLines = markdown
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""));

  const compacted: string[] = [];
  let previousBlank = false;

  for (const line of normalizedLines) {
    const isBlank = line.trim().length === 0;

    if (isBlank && previousBlank) {
      continue;
    }

    compacted.push(line);
    previousBlank = isBlank;
  }

  const value = compacted.join("\n").trim();
  return `${value}\n`;
}
