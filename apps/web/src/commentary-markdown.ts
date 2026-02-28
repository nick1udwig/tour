import { type SlideBlock } from "./markdown";

export interface StructuredLineSection {
  absoluteLines: number[];
  blocks: SlideBlock[];
}

export function renderMarkdown(markdown: string): HTMLElement {
  const root = document.createElement("div");
  root.className = "markdown-render";

  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  let index = 0;

  while (index < lines.length) {
    const current = lines[index].trimEnd();

    if (!current.trim()) {
      index += 1;
      continue;
    }

    if (/^#{2,4}\s+/.test(current)) {
      const level = current.match(/^#+/)?.[0].length ?? 2;
      const heading = document.createElement(level <= 2 ? "h3" : "h4");
      appendInlineMarkdown(heading, current.replace(/^#{2,4}\s+/, "").trim());
      root.appendChild(heading);
      index += 1;
      continue;
    }

    if (current.startsWith("- ")) {
      const list = document.createElement("ul");
      while (index < lines.length && lines[index].trim().startsWith("- ")) {
        const item = document.createElement("li");
        appendInlineMarkdown(item, lines[index].trim().replace(/^-\s+/, ""));
        list.appendChild(item);
        index += 1;
      }
      root.appendChild(list);
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const line = lines[index].trim();
      if (!line || line.startsWith("- ") || /^#{2,4}\s+/.test(line)) {
        break;
      }
      paragraphLines.push(line);
      index += 1;
    }

    const paragraph = document.createElement("p");
    appendInlineMarkdown(paragraph, paragraphLines.join(" "));
    root.appendChild(paragraph);
  }

  return root;
}

export function blocksToMarkdown(blocks: SlideBlock[]): string {
  const sections: string[] = [];

  for (const block of blocks) {
    if (block.type === "heading") {
      sections.push(`${"#".repeat(block.level)} ${block.text}`);
      continue;
    }

    if (block.type === "paragraph") {
      sections.push(block.text);
      continue;
    }

    if (block.type === "list") {
      sections.push(block.items.map((item) => `- ${item}`).join("\n"));
      continue;
    }
  }

  return sections.join("\n\n");
}

export function parseStructuredCommentarySections(
  blocks: SlideBlock[]
): { overviewBlocks: SlideBlock[]; lineSections: StructuredLineSection[] } | null {
  const overviewBlocks: SlideBlock[] = [];
  const lineSections: StructuredLineSection[] = [];
  let sawStructuredHeading = false;
  let currentTarget: { kind: "overview" } | { kind: "line"; section: StructuredLineSection } | null = null;

  for (const block of blocks) {
    if (block.type === "heading") {
      if (isOverviewHeading(block.text)) {
        sawStructuredHeading = true;
        currentTarget = { kind: "overview" };
        continue;
      }

      const absoluteLines = parseLineHeadingLines(block.text);
      if (absoluteLines.length > 0) {
        sawStructuredHeading = true;
        const section: StructuredLineSection = {
          absoluteLines,
          blocks: []
        };
        lineSections.push(section);
        currentTarget = { kind: "line", section };
        continue;
      }
    }

    if (currentTarget?.kind === "line") {
      currentTarget.section.blocks.push(block);
      continue;
    }

    overviewBlocks.push(block);
  }

  if (!sawStructuredHeading) {
    return null;
  }

  return {
    overviewBlocks,
    lineSections
  };
}

export function mapAbsoluteLinesToRows(absoluteLines: number[], firstLine: number, rowCount: number): number[] {
  const rows = new Set<number>();

  for (const absoluteLine of absoluteLines) {
    const row = absoluteLine - firstLine + 1;
    if (row >= 1 && row <= rowCount) {
      rows.add(row);
    }
  }

  return [...rows].sort((left, right) => left - right);
}

export function parseSnippetStartLine(lines?: string): number {
  const [start] = parseSnippetLineRange(lines);
  return start;
}

export function parseSnippetAbsoluteLines(lines?: string): number[] {
  const [start, end] = parseSnippetLineRange(lines);
  if (start === 1 && end === 1 && !lines) {
    return [];
  }

  return expandLineRange(start, end);
}

export function formatLineLabel(absoluteLines: number[]): string {
  if (absoluteLines.length === 0) {
    return "line";
  }

  const start = absoluteLines[0];
  const end = absoluteLines[absoluteLines.length - 1];

  if (start === end) {
    return `line ${start}`;
  }

  return `lines ${start}-${end}`;
}

export function defaultLineComment(absoluteLines: number[]): string {
  return `Commentary for ${formatLineLabel(absoluteLines)}.`;
}

function appendInlineMarkdown(target: HTMLElement, text: string): void {
  const tokenPattern = /`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let cursor = 0;

  for (const match of text.matchAll(tokenPattern)) {
    const matchIndex = match.index ?? 0;
    if (matchIndex > cursor) {
      target.append(document.createTextNode(text.slice(cursor, matchIndex)));
    }

    if (match[1]) {
      const code = document.createElement("code");
      code.textContent = match[1];
      target.appendChild(code);
    } else if (match[2] && match[3]) {
      const link = document.createElement("a");
      link.href = match[3];
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = match[2];
      target.appendChild(link);
    } else if (match[4]) {
      const strong = document.createElement("strong");
      strong.textContent = match[4];
      target.appendChild(strong);
    } else if (match[5]) {
      const em = document.createElement("em");
      em.textContent = match[5];
      target.appendChild(em);
    }

    cursor = matchIndex + match[0].length;
  }

  if (cursor < text.length) {
    target.append(document.createTextNode(text.slice(cursor)));
  }
}

function parseSnippetLineRange(lines?: string): [number, number] {
  if (!lines) {
    return [1, 1];
  }

  const match = /^(\d+)(?:-(\d+))?$/.exec(lines.trim());
  if (!match) {
    return [1, 1];
  }

  const start = Number.parseInt(match[1], 10);
  const end = match[2] ? Number.parseInt(match[2], 10) : start;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < 1) {
    return [1, 1];
  }

  return [start, end];
}

function isOverviewHeading(text: string): boolean {
  return /^overview\b/i.test(text.trim());
}

function parseLineHeadingLines(text: string): number[] {
  const normalized = text.trim();
  const rangeMatch = /^lines?\s+(\d+)\s*-\s*(\d+)\b/i.exec(normalized);
  if (rangeMatch) {
    const start = Number.parseInt(rangeMatch[1], 10);
    const end = Number.parseInt(rangeMatch[2], 10);
    return expandLineRange(start, end);
  }

  const singleMatch = /^lines?\s+(\d+)\b/i.exec(normalized);
  if (!singleMatch) {
    return [];
  }

  const line = Number.parseInt(singleMatch[1], 10);
  return expandLineRange(line, line);
}

function expandLineRange(start: number, end: number): number[] {
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return [];
  }

  const low = Math.max(1, Math.min(start, end));
  const high = Math.max(start, end);
  const lines: number[] = [];

  for (let line = low; line <= high; line += 1) {
    lines.push(line);
  }

  return lines;
}
