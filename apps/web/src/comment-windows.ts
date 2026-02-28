import { type SlideSnippet } from "./markdown";
import { renderMarkdown } from "./commentary-markdown";

export interface LineComment {
  id: string;
  absoluteLines: number[];
  markdown: string;
  label: string;
}

export interface CommentWindowManager {
  toggle(comment: LineComment, snippet: SlideSnippet): void;
  dispose(): void;
}

export function createCommentWindowManager(root: HTMLElement): CommentWindowManager {
  const layer = document.createElement("div");
  layer.className = "comment-layer";
  root.appendChild(layer);

  const windowsByCommentId = new Map<string, HTMLDivElement>();

  const closeWindow = (panel: HTMLDivElement): void => {
    for (const [commentId, candidate] of windowsByCommentId.entries()) {
      if (candidate === panel) {
        windowsByCommentId.delete(commentId);
        break;
      }
    }
    panel.remove();
  };

  const closeAll = (): void => {
    for (const panel of windowsByCommentId.values()) {
      panel.remove();
    }
    windowsByCommentId.clear();
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

  const toggle = (comment: LineComment, snippet: SlideSnippet): void => {
    const existing = windowsByCommentId.get(comment.id);
    if (existing) {
      closeWindow(existing);
      return;
    }

    const panel = document.createElement("div");
    panel.className = "comment-window";

    const startingWidth = 340;
    const startingHeight = 220;
    const offset = windowsByCommentId.size * 24;

    panel.style.width = `${startingWidth}px`;
    panel.style.height = `${startingHeight}px`;
    panel.style.left = `${Math.max(12, root.clientWidth - startingWidth - 24 - offset)}px`;
    panel.style.top = `${Math.max(12, 24 + offset)}px`;

    const titlebar = document.createElement("div");
    titlebar.className = "comment-window-titlebar";

    const title = document.createElement("div");
    title.className = "comment-window-title";

    const pathLabel = document.createElement("span");
    pathLabel.className = "comment-window-path";
    pathLabel.textContent = snippet.path ?? "snippet";
    pathLabel.title = snippet.path ?? "snippet";

    const lineLabel = document.createElement("span");
    lineLabel.className = "comment-window-label";
    lineLabel.textContent = comment.label;

    title.append(pathLabel, lineLabel);

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
    windowsByCommentId.set(comment.id, panel);

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
    toggle,
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

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

function iconClose(): string {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>`;
}
