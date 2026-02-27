import { type Slide, type SlideBlock, type SlideSnippet } from "./markdown";

interface SnippetContext {
  snippet: SlideSnippet;
  overallMarkdown: string;
  lineComments: LineComment[];
}

interface LineComment {
  id: string;
  lines: number[];
  row: number;
  markdown: string;
  label: string;
}

interface CommentWindowManager {
  open(comment: LineComment, snippet: SlideSnippet): void;
  dispose(): void;
}

export function renderSlideContent(root: HTMLElement, slide: Slide): () => void {
  root.innerHTML = "";

  const layout = document.createElement("div");
  layout.className = "slide-layout";

  const windowManager = createCommentWindowManager(root);
  const { contexts, fallbackMarkdown } = buildSnippetContexts(slide.blocks);

  if (contexts.length === 0) {
    const standalone = document.createElement("section");
    standalone.className = "standalone-markdown";
    standalone.appendChild(renderMarkdown(fallbackMarkdown));
    layout.appendChild(standalone);
  } else {
    for (const context of contexts) {
      layout.appendChild(renderSnippetContext(context, windowManager));
    }
  }

  root.appendChild(layout);
  return () => {
    windowManager.dispose();
  };
}

function renderSnippetContext(context: SnippetContext, manager: CommentWindowManager): HTMLElement {
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

  const snippetLines = context.snippet.code.split("\n");
  const firstLine = parseSnippetStartLine(context.snippet.lines);
  const highlighted = new Set(normalizeHighlights(context.snippet.highlightLines, firstLine, snippetLines.length));

  const commentsByRow = new Map<number, LineComment[]>();
  for (const comment of context.lineComments) {
    const list = commentsByRow.get(comment.row) ?? [];
    list.push(comment);
    commentsByRow.set(comment.row, list);
  }

  snippetLines.forEach((line, offset) => {
    const row = document.createElement("div");
    row.className = "code-line";

    const rowNumber = offset + 1;
    if (highlighted.has(rowNumber)) {
      row.classList.add("highlight");
    }

    const lineNo = document.createElement("span");
    lineNo.className = "line-no";
    lineNo.textContent = String(firstLine + offset);

    const codeText = document.createElement("span");
    codeText.className = "line-text";
    codeText.textContent = line || " ";

    const commentCell = document.createElement("span");
    commentCell.className = "line-comment-cell";

    const rowComments = commentsByRow.get(rowNumber) ?? [];
    for (const comment of rowComments) {
      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "line-comment-trigger";
      trigger.setAttribute("aria-label", `Open comment for ${comment.label}`);
      trigger.innerHTML = iconNote();
      trigger.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        manager.open(comment, context.snippet);
      });
      commentCell.appendChild(trigger);
    }

    row.append(lineNo, codeText, commentCell);
    code.appendChild(row);
  });

  pre.appendChild(code);
  wrapper.append(meta, pre);

  if (context.overallMarkdown.trim()) {
    wrapper.appendChild(renderOverallComments(context.overallMarkdown));
  }

  return wrapper;
}

function renderOverallComments(markdown: string): HTMLElement {
  const shell = document.createElement("section");
  shell.className = "overall-comments";

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "overall-toggle";
  toggle.setAttribute("aria-label", "Collapse comments");
  toggle.innerHTML = iconChevronDown();

  const body = document.createElement("div");
  body.className = "overall-comment-body";
  body.dataset.collapsed = "false";
  body.appendChild(renderMarkdown(markdown));

  toggle.addEventListener("click", () => {
    const collapsed = body.dataset.collapsed === "true";
    body.dataset.collapsed = collapsed ? "false" : "true";
    toggle.setAttribute("aria-label", collapsed ? "Collapse comments" : "Expand comments");
    toggle.innerHTML = collapsed ? iconChevronDown() : iconChevronUp();
  });

  shell.append(toggle, body);
  return shell;
}

function buildSnippetContexts(blocks: SlideBlock[]): { contexts: SnippetContext[]; fallbackMarkdown: string } {
  const contexts: Array<{ snippet: SlideSnippet; noteBlocks: SlideBlock[] }> = [];
  let current: { snippet: SlideSnippet; noteBlocks: SlideBlock[] } | null = null;
  let pendingBeforeFirst: SlideBlock[] = [];

  for (const block of blocks) {
    if (block.type === "code") {
      const noteBlocks: SlideBlock[] = current === null ? [...pendingBeforeFirst] : [];
      pendingBeforeFirst = [];
      current = {
        snippet: block.snippet,
        noteBlocks
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
      fallbackMarkdown: blocksToMarkdown(blocks)
    };
  }

  const hydrated = contexts.map((entry, index) => materializeContext(entry.snippet, entry.noteBlocks, index));
  return {
    contexts: hydrated,
    fallbackMarkdown: ""
  };
}

function materializeContext(snippet: SlideSnippet, noteBlocks: SlideBlock[], index: number): SnippetContext {
  const groups = groupConsecutive(normalizeHighlights(snippet.highlightLines, parseSnippetStartLine(snippet.lines), snippet.code.split("\n").length));

  const listItems: string[] = [];
  const overallBlocks: SlideBlock[] = [];

  for (const block of noteBlocks) {
    if (block.type === "list") {
      listItems.push(...block.items);
      continue;
    }

    overallBlocks.push(block);
  }

  const firstLine = parseSnippetStartLine(snippet.lines);
  const lineComments = groups.map((lines, groupIndex) => {
    const comment = listItems[groupIndex] ?? defaultLineComment(lines, firstLine);

    return {
      id: `snippet-${index}-comment-${groupIndex}`,
      lines,
      row: lines[0],
      markdown: comment,
      label: formatLineLabel(lines, firstLine)
    } satisfies LineComment;
  });

  const remainingListItems = listItems.slice(groups.length);
  if (remainingListItems.length > 0) {
    overallBlocks.push({
      type: "list",
      items: remainingListItems
    });
  }

  return {
    snippet,
    overallMarkdown: blocksToMarkdown(overallBlocks),
    lineComments
  };
}

function createCommentWindowManager(root: HTMLElement): CommentWindowManager {
  const layer = document.createElement("div");
  layer.className = "comment-layer";
  root.appendChild(layer);

  const windows = new Set<HTMLDivElement>();

  const closeWindow = (panel: HTMLDivElement): void => {
    windows.delete(panel);
    panel.remove();
  };

  const closeAll = (): void => {
    for (const panel of windows) {
      panel.remove();
    }
    windows.clear();
  };

  const onOutsidePointerDown = (event: PointerEvent): void => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.closest(".comment-window") || target.closest(".line-comment-trigger")) {
      return;
    }

    closeAll();
  };

  document.addEventListener("pointerdown", onOutsidePointerDown);

  const open = (comment: LineComment, snippet: SlideSnippet): void => {
    const panel = document.createElement("div");
    panel.className = "comment-window";

    const startingWidth = 340;
    const startingHeight = 220;
    const offset = windows.size * 24;

    panel.style.width = `${startingWidth}px`;
    panel.style.height = `${startingHeight}px`;
    panel.style.left = `${Math.max(12, root.clientWidth - startingWidth - 24 - offset)}px`;
    panel.style.top = `${Math.max(12, 24 + offset)}px`;

    const titlebar = document.createElement("div");
    titlebar.className = "comment-window-titlebar";

    const title = document.createElement("p");
    title.className = "comment-window-title";
    title.textContent = `${snippet.path ?? "snippet"} · ${comment.label}`;

    const close = document.createElement("button");
    close.type = "button";
    close.className = "comment-window-close";
    close.setAttribute("aria-label", "Close comment");
    close.innerHTML = iconClose();
    close.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeWindow(panel);
    });

    titlebar.append(title, close);

    const body = document.createElement("div");
    body.className = "comment-window-body";
    body.appendChild(renderMarkdown(comment.markdown));

    const resizeHandle = document.createElement("div");
    resizeHandle.className = "comment-resize-handle";
    resizeHandle.setAttribute("aria-hidden", "true");

    panel.append(titlebar, body, resizeHandle);

    installDragBehavior(panel, titlebar, layer);
    installResizeBehavior(panel, resizeHandle, layer);

    layer.appendChild(panel);
    windows.add(panel);

    requestAnimationFrame(() => {
      panel.classList.add("is-open");
    });
  };

  const dispose = (): void => {
    document.removeEventListener("pointerdown", onOutsidePointerDown);
    closeAll();
    layer.remove();
  };

  return {
    open,
    dispose
  };
}

function installDragBehavior(panel: HTMLDivElement, handle: HTMLDivElement, boundary: HTMLElement): void {
  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();

    const boundaryRect = boundary.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();

    const startX = event.clientX;
    const startY = event.clientY;
    const startLeft = panelRect.left - boundaryRect.left;
    const startTop = panelRect.top - boundaryRect.top;

    const onPointerMove = (moveEvent: PointerEvent): void => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      const maxLeft = Math.max(0, boundaryRect.width - panel.offsetWidth);
      const maxTop = Math.max(0, boundaryRect.height - panel.offsetHeight);

      const nextLeft = clamp(startLeft + dx, 0, maxLeft);
      const nextTop = clamp(startTop + dy, 0, maxTop);

      panel.style.left = `${nextLeft}px`;
      panel.style.top = `${nextTop}px`;
    };

    const onPointerUp = (): void => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  });
}

function installResizeBehavior(panel: HTMLDivElement, handle: HTMLDivElement, boundary: HTMLElement): void {
  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();

    const boundaryRect = boundary.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();

    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = panelRect.width;
    const startHeight = panelRect.height;
    const startLeft = panelRect.left - boundaryRect.left;
    const startTop = panelRect.top - boundaryRect.top;

    const onPointerMove = (moveEvent: PointerEvent): void => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      const maxWidth = Math.max(220, boundaryRect.width - startLeft);
      const maxHeight = Math.max(120, boundaryRect.height - startTop);

      const nextWidth = clamp(startWidth + dx, 220, maxWidth);
      const nextHeight = clamp(startHeight + dy, 120, maxHeight);

      panel.style.width = `${nextWidth}px`;
      panel.style.height = `${nextHeight}px`;
    };

    const onPointerUp = (): void => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  });
}

function renderMarkdown(markdown: string): HTMLElement {
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

function blocksToMarkdown(blocks: SlideBlock[]): string {
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

function normalizeHighlights(highlightLines: number[], startLine: number, rowCount: number): number[] {
  const relative = new Set<number>();

  for (const entry of highlightLines) {
    if (!Number.isInteger(entry) || entry <= 0) {
      continue;
    }

    let row = entry;
    if (entry > rowCount) {
      row = entry - startLine + 1;
    }

    if (row >= 1 && row <= rowCount) {
      relative.add(row);
    }
  }

  return [...relative].sort((left, right) => left - right);
}

function groupConsecutive(values: number[]): number[][] {
  const groups: number[][] = [];

  for (const value of values) {
    const current = groups.at(-1);
    if (!current || value !== current[current.length - 1] + 1) {
      groups.push([value]);
      continue;
    }

    current.push(value);
  }

  return groups;
}

function parseSnippetStartLine(lines?: string): number {
  if (!lines) {
    return 1;
  }

  const match = /^(\d+)(?:-\d+)?$/.exec(lines.trim());
  if (!match) {
    return 1;
  }

  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function formatLineLabel(lines: number[], firstLine: number): string {
  if (lines.length === 0) {
    return "line";
  }

  const start = firstLine + lines[0] - 1;
  const end = firstLine + lines[lines.length - 1] - 1;

  if (start === end) {
    return `line ${start}`;
  }

  return `lines ${start}-${end}`;
}

function defaultLineComment(lines: number[], firstLine: number): string {
  return `Commentary for ${formatLineLabel(lines, firstLine)}.`;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
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

function iconClose(): string {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>`;
}
