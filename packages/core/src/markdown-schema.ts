import { REQUIRED_MARKDOWN_SECTIONS } from "@tour/shared";

import { wordCount } from "./utils";

export interface MarkdownValidationResult {
  ok: boolean;
  errors: string[];
  estimatedMinutes: number;
  slideCount: number;
}

export function validateMarkdownContract(markdown: string): MarkdownValidationResult {
  const errors: string[] = [];
  const normalized = markdown.replace(/\r\n?/g, "\n");
  const slides = normalized
    .split(/\n---\n/g)
    .map((slide) => slide.trim())
    .filter(Boolean);

  if (slides.length === 0) {
    errors.push("Deck must contain at least one slide");
  }

  for (const [index, slide] of slides.entries()) {
    if (!/^#{1,2}\s+.+/m.test(slide)) {
      errors.push(`Slide ${index + 1} is missing a title heading`);
    }
  }

  if (!REQUIRED_MARKDOWN_SECTIONS.setup.test(normalized)) {
    errors.push("Deck must include at least one pragmatic setup/build/run/test slide");
  }

  if (!REQUIRED_MARKDOWN_SECTIONS.architecture.test(normalized)) {
    errors.push("Deck must include at least one architecture or data-flow slide");
  }

  if (!REQUIRED_MARKDOWN_SECTIONS.entryPoints.test(normalized)) {
    errors.push("Deck must include at least one entry-point/where-to-start slide");
  }

  validateSnippetMetadata(normalized, errors);

  const estimatedMinutes = Math.ceil(wordCount(normalized) / 180);
  if (estimatedMinutes > 60) {
    errors.push(`Estimated read duration ${estimatedMinutes} exceeds 60 minutes`);
  }

  return {
    ok: errors.length === 0,
    errors,
    estimatedMinutes,
    slideCount: slides.length
  };
}

export function assertMarkdownContract(markdown: string): void {
  const validation = validateMarkdownContract(markdown);
  if (!validation.ok) {
    throw new Error(`Markdown validation failed:\n- ${validation.errors.join("\n- ")}`);
  }
}

function validateSnippetMetadata(markdown: string, errors: string[]): void {
  const blockPattern = /```([^\n]*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null = null;

  while ((match = blockPattern.exec(markdown)) !== null) {
    const info = match[1].trim();
    if (!info || !/path=/.test(info)) {
      continue;
    }

    if (!/lines=\d+-\d+/.test(info)) {
      errors.push(`Snippet missing lines metadata: ${info}`);
    }

    if (!/highlight=\d+(,\d+)*/.test(info)) {
      errors.push(`Snippet missing highlight metadata: ${info}`);
    }

    if (!/permalink=https:\/\/github\.com\/.+\/blob\/.+/.test(info)) {
      errors.push(`Snippet missing commit-pinned permalink metadata: ${info}`);
    }
  }
}
