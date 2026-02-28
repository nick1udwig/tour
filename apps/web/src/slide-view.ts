import {
  createCommentWindowManager,
  type CommentWindowManager,
  type LineComment
} from "./comment-windows";
import {
  blocksToMarkdown,
  defaultLineComment,
  formatLineLabel,
  mapAbsoluteLinesToRows,
  parseSnippetAbsoluteLines,
  parseSnippetStartLine,
  parseStructuredCommentarySections,
  renderMarkdown
} from "./commentary-markdown";
import { fetchRepoFile } from "./api";
import { type Slide, type SlideBlock, type SlideSnippet } from "./markdown";

interface RenderSlideOptions {
  jobId?: string;
}

interface SnippetContext {
  snippet: SlideSnippet;
  lineComments: LineComment[];
  focusAbsoluteLines: number[];
}

interface MaterializedSnippetContext extends SnippetContext {
  overviewBlocks: SlideBlock[];
}

interface RenderSnippetOptions {
  jobId?: string;
  isDisposed: () => boolean;
}

interface CommentRows {
  comment: LineComment;
  rows: number[];
  triggerRow: number | null;
}

export function renderSlideContent(root: HTMLElement, slide: Slide, options: RenderSlideOptions = {}): () => void {
  root.innerHTML = "";

  const layout = document.createElement("div");
  layout.className = "slide-layout";

  let disposed = false;
  const windowManager = createCommentWindowManager(root);
  const { contexts, overviewMarkdown, fallbackMarkdown } = buildSnippetContexts(slide.blocks);

  if (contexts.length === 0) {
    const standalone = document.createElement("section");
    standalone.className = "standalone-markdown";
    standalone.appendChild(renderMarkdown(fallbackMarkdown));
    layout.appendChild(standalone);
  } else {
    if (overviewMarkdown.trim()) {
      layout.appendChild(renderOverallComments(overviewMarkdown));
    }

    const stack = document.createElement("section");
    stack.className = "snippet-stack";

    for (const context of contexts) {
      stack.appendChild(
        renderSnippetContext(context, windowManager, {
          jobId: options.jobId,
          isDisposed: () => disposed
        })
      );
    }

    layout.appendChild(stack);
  }

  root.appendChild(layout);
  return () => {
    disposed = true;
    windowManager.dispose();
  };
}

function renderSnippetContext(
  context: SnippetContext,
  manager: CommentWindowManager,
  options: RenderSnippetOptions
): HTMLElement {
  const wrapper = document.createElement("section");
  wrapper.className = "snippet";

  const meta = document.createElement("div");
  meta.className = "snippet-meta";

  const location = document.createElement("span");
  location.textContent = [context.snippet.path ?? "(path missing)", context.snippet.lines ? `lines ${context.snippet.lines}` : ""]
    .filter(Boolean)
    .join(" · ");
  meta.appendChild(location);

  if (context.snippet.permalink) {
    const link = document.createElement("a");
    link.href = context.snippet.permalink;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = "View on GitHub";
    meta.appendChild(link);
  }

  const pre = document.createElement("pre");
  const code = document.createElement("code");
  code.className = `language-${context.snippet.language}`;
  pre.appendChild(code);

  const fallbackLineStart = parseSnippetStartLine(context.snippet.lines);
  paintCodeRows({
    code,
    pre,
    snippet: context.snippet,
    lineComments: context.lineComments,
    focusAbsoluteLines: context.focusAbsoluteLines,
    manager,
    sourceText: context.snippet.code,
    visibleLineStart: fallbackLineStart
  });

  if (options.jobId && context.snippet.path) {
    fetchRepoFile(options.jobId, context.snippet.path)
      .then((fullFileContent) => {
        if (options.isDisposed()) {
          return;
        }

        paintCodeRows({
          code,
          pre,
          snippet: context.snippet,
          lineComments: context.lineComments,
          focusAbsoluteLines: context.focusAbsoluteLines,
          manager,
          sourceText: fullFileContent,
          visibleLineStart: 1
        });
      })
      .catch(() => {
        // Keep fallback snippet rendering when full file cannot be loaded.
      });
  }

  wrapper.append(meta, pre);
  return wrapper;
}

function paintCodeRows(input: {
  code: HTMLElement;
  pre: HTMLElement;
  snippet: SlideSnippet;
  lineComments: LineComment[];
  focusAbsoluteLines: number[];
  manager: CommentWindowManager;
  sourceText: string;
  visibleLineStart: number;
}): void {
  const { code, pre, snippet, lineComments, focusAbsoluteLines, manager, sourceText, visibleLineStart } = input;
  const sourceLines = extractCodeLines(sourceText);
  const rowCount = sourceLines.length;

  const mappedComments: CommentRows[] = lineComments
    .map((comment) => {
      const rows = mapAbsoluteLinesToRows(comment.absoluteLines, visibleLineStart, rowCount);
      return {
        comment,
        rows,
        triggerRow: rows[0] ?? null
      };
    })
    .filter((entry) => entry.rows.length > 0);

  const commentsByLineRow = new Map<number, LineComment[]>();
  const commentsByTriggerRow = new Map<number, LineComment[]>();
  for (const entry of mappedComments) {
    if (entry.triggerRow !== null) {
      const triggerRows = commentsByTriggerRow.get(entry.triggerRow) ?? [];
      triggerRows.push(entry.comment);
      commentsByTriggerRow.set(entry.triggerRow, triggerRows);
    }

    for (const row of entry.rows) {
      const lineRows = commentsByLineRow.get(row) ?? [];
      lineRows.push(entry.comment);
      commentsByLineRow.set(row, lineRows);
    }
  }

  const focusRows = mapAbsoluteLinesToRows(focusAbsoluteLines, visibleLineStart, rowCount);
  const focusRowSet = new Set(focusRows);

  code.innerHTML = "";

  sourceLines.forEach((line, offset) => {
    const row = document.createElement("div");
    row.className = "code-line";

    const rowNumber = offset + 1;
    row.dataset.row = String(rowNumber);

    if (focusRowSet.has(rowNumber)) {
      row.classList.add("focused");
    }

    const rowComments = commentsByLineRow.get(rowNumber) ?? [];
    if (rowComments.length > 0) {
      row.classList.add("annotated", "highlight");
      row.addEventListener("click", (event) => {
        const target = event.target;
        if (target instanceof HTMLElement && target.closest(".line-comment-trigger")) {
          return;
        }

        manager.toggle(rowComments[0], snippet);
      });
    }

    const lineNo = document.createElement("span");
    lineNo.className = "line-no";
    lineNo.textContent = String(visibleLineStart + offset);

    const codeText = document.createElement("span");
    codeText.className = "line-text";
    codeText.textContent = line || " ";

    const commentCell = document.createElement("span");
    commentCell.className = "line-comment-cell";

    const rowTriggers = commentsByTriggerRow.get(rowNumber) ?? [];
    for (const comment of rowTriggers) {
      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "line-comment-trigger";
      trigger.setAttribute("aria-label", `Open comment for ${comment.label}`);
      trigger.innerHTML = iconNote();
      trigger.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        manager.toggle(comment, snippet);
      });
      commentCell.appendChild(trigger);
    }

    row.append(lineNo, codeText, commentCell);
    code.appendChild(row);
  });

  focusCodeViewport(pre, code, focusRows[0] ?? mappedComments[0]?.triggerRow ?? null);
}

function focusCodeViewport(pre: HTMLElement, code: HTMLElement, rowNumber: number | null): void {
  if (!rowNumber) {
    return;
  }

  requestAnimationFrame(() => {
    const row = code.querySelector<HTMLElement>(`.code-line[data-row="${rowNumber}"]`);
    if (!row) {
      return;
    }

    const targetTop = row.offsetTop - pre.clientHeight * 0.25;
    pre.scrollTop = Math.max(0, targetTop);
  });
}

function extractCodeLines(sourceText: string): string[] {
  const normalized = sourceText.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  if (lines.length > 1 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  return lines;
}

function renderOverallComments(markdown: string): HTMLElement {
  const shell = document.createElement("section");
  shell.className = "overall-comments slide-overview";

  const header = document.createElement("div");
  header.className = "overall-header";

  const label = document.createElement("p");
  label.className = "overall-label";
  label.textContent = "Overview";

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "overall-toggle slide-overview-toggle";
  toggle.setAttribute("aria-label", "Collapse overview");
  toggle.innerHTML = iconChevronUp();

  const body = document.createElement("div");
  body.className = "overall-comment-body slide-overview-body";
  body.dataset.collapsed = "false";
  body.appendChild(renderMarkdown(markdown));

  toggle.addEventListener("click", () => {
    const collapsed = body.dataset.collapsed === "true";
    const nextCollapsed = !collapsed;
    body.dataset.collapsed = nextCollapsed ? "true" : "false";
    toggle.setAttribute("aria-label", nextCollapsed ? "Expand overview" : "Collapse overview");
    toggle.innerHTML = nextCollapsed ? iconChevronDown() : iconChevronUp();
  });

  header.append(label, toggle);
  shell.append(header, body);
  return shell;
}

function buildSnippetContexts(blocks: SlideBlock[]): {
  contexts: SnippetContext[];
  overviewMarkdown: string;
  fallbackMarkdown: string;
} {
  const contexts: Array<{ snippet: SlideSnippet; noteBlocks: SlideBlock[] }> = [];
  let current: { snippet: SlideSnippet; noteBlocks: SlideBlock[] } | null = null;
  const pendingBeforeFirst: SlideBlock[] = [];

  for (const block of blocks) {
    if (block.type === "code") {
      current = {
        snippet: block.snippet,
        noteBlocks: []
      };
      contexts.push(current);
      continue;
    }

    if (current) {
      current.noteBlocks.push(block);
    } else {
      pendingBeforeFirst.push(block);
    }
  }

  if (contexts.length === 0) {
    return {
      contexts: [],
      overviewMarkdown: "",
      fallbackMarkdown: blocksToMarkdown(blocks)
    };
  }

  const overviewBlocks = [...pendingBeforeFirst];
  const hydrated: SnippetContext[] = [];

  for (const [index, entry] of contexts.entries()) {
    const materialized = materializeContext(entry.snippet, entry.noteBlocks, index);
    hydrated.push({
      snippet: materialized.snippet,
      lineComments: materialized.lineComments,
      focusAbsoluteLines: materialized.focusAbsoluteLines
    });

    if (materialized.overviewBlocks.length > 0) {
      overviewBlocks.push(...materialized.overviewBlocks);
    }
  }

  return {
    contexts: hydrated,
    overviewMarkdown: blocksToMarkdown(overviewBlocks),
    fallbackMarkdown: ""
  };
}

function materializeContext(snippet: SlideSnippet, noteBlocks: SlideBlock[], index: number): MaterializedSnippetContext {
  const structured = parseStructuredCommentarySections(noteBlocks);
  const lineComments: LineComment[] = [];
  const overviewBlocks = structured ? structured.overviewBlocks : noteBlocks;

  if (structured) {
    for (const [sectionIndex, section] of structured.lineSections.entries()) {
      if (section.absoluteLines.length === 0) {
        continue;
      }

      lineComments.push({
        id: `snippet-${index}-structured-${sectionIndex}`,
        absoluteLines: section.absoluteLines,
        markdown: blocksToMarkdown(section.blocks).trim() || defaultLineComment(section.absoluteLines),
        label: formatLineLabel(section.absoluteLines)
      });
    }
  }

  return {
    snippet,
    overviewBlocks,
    lineComments,
    focusAbsoluteLines: parseSnippetAbsoluteLines(snippet.lines)
  };
}

function iconNote(): string {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10a2 2 0 0 1 2 2v12l-4-2-4 2-4-2-4 2V6a2 2 0 0 1 2-2z" /></svg>`;
}

function iconChevronDown(): string {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>`;
}

function iconChevronUp(): string {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg>`;
}
