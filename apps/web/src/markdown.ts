export interface SlideSnippet {
  language: string;
  path?: string;
  lines?: string;
  permalink?: string;
  highlightLines: number[];
  code: string;
}

export type SlideBlock =
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "code"; snippet: SlideSnippet };

export interface Slide {
  title: string;
  blocks: SlideBlock[];
}

export function parseSlides(markdown: string): Slide[] {
  const rawSlides = markdown
    .replace(/\r\n?/g, "\n")
    .split(/\n---\n/g)
    .map((entry) => entry.trim())
    .filter(Boolean);

  return rawSlides.map(parseSlide);
}

function parseSlide(raw: string): Slide {
  const lines = raw.split("\n");
  const titleLineIndex = lines.findIndex((line) => /^#\s+/.test(line));
  const title = titleLineIndex >= 0 ? lines[titleLineIndex].replace(/^#\s+/, "").trim() : "Untitled";

  const contentLines = titleLineIndex >= 0 ? lines.slice(titleLineIndex + 1) : lines;
  const blocks: SlideBlock[] = [];

  for (let index = 0; index < contentLines.length; index += 1) {
    const line = contentLines[index];

    if (line.startsWith("```")) {
      const info = line.slice(3).trim();
      const codeLines: string[] = [];
      index += 1;
      while (index < contentLines.length && !contentLines[index].startsWith("```")) {
        codeLines.push(contentLines[index]);
        index += 1;
      }

      blocks.push({
        type: "code",
        snippet: parseSnippet(info, codeLines.join("\n"))
      });
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push({
        type: "heading",
        level: 2,
        text: line.replace(/^##\s+/, "").trim()
      });
      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push({
        type: "heading",
        level: 3,
        text: line.replace(/^###\s+/, "").trim()
      });
      continue;
    }

    if (line.startsWith("- ")) {
      const items = [line.replace(/^-\s+/, "").trim()];
      while (index + 1 < contentLines.length && contentLines[index + 1].startsWith("- ")) {
        index += 1;
        items.push(contentLines[index].replace(/^-\s+/, "").trim());
      }

      blocks.push({
        type: "list",
        items
      });
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const paragraphLines = [trimmed];
    while (
      index + 1 < contentLines.length &&
      contentLines[index + 1].trim() &&
      !contentLines[index + 1].startsWith("- ") &&
      !contentLines[index + 1].startsWith("##") &&
      !contentLines[index + 1].startsWith("```")
    ) {
      index += 1;
      paragraphLines.push(contentLines[index].trim());
    }

    blocks.push({
      type: "paragraph",
      text: paragraphLines.join(" ")
    });
  }

  return {
    title,
    blocks
  };
}

function parseSnippet(info: string, code: string): SlideSnippet {
  const tokens = info.split(/\s+/).filter(Boolean);
  const language = tokens[0]?.includes("=") ? "text" : tokens[0] || "text";

  const kv = new Map<string, string>();
  for (const token of tokens.slice(language === "text" ? 0 : 1)) {
    const [key, ...valueParts] = token.split("=");
    if (!key || valueParts.length === 0) {
      continue;
    }
    kv.set(key, valueParts.join("="));
  }

  const highlights = (kv.get("highlight") ?? "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);

  return {
    language,
    path: kv.get("path"),
    lines: kv.get("lines"),
    permalink: kv.get("permalink"),
    highlightLines: highlights,
    code
  };
}
