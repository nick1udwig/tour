import "./style.css";
import "./print.css";

import { fetchJobStatus, fetchSlidesMarkdown } from "./api";
import { saveMarkdown, savePdf } from "./export";
import { parseSlides, type Slide, type SlideBlock, type SlideSnippet } from "./markdown";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("Missing #app root element");
}

const params = new URLSearchParams(window.location.search);
const jobId = params.get("jobId");

if (!jobId) {
  app.innerHTML = `<main class="app-shell"><h1>Missing jobId</h1><p>Open from the CLI URL output.</p></main>`;
} else {
  boot(app, jobId).catch((error) => {
    app.innerHTML = `<main class="app-shell"><h1>Load failed</h1><p>${escapeHtml(
      error instanceof Error ? error.message : String(error)
    )}</p></main>`;
  });
}

async function boot(appRoot: HTMLDivElement, currentJobId: string): Promise<void> {
  appRoot.innerHTML = shellMarkup(currentJobId);

  const statusLine = selectEl<HTMLParagraphElement>("#status-line");
  const spinner = selectEl<HTMLDivElement>("#spinner");
  const deckRoot = selectEl<HTMLDivElement>("#deck-root");
  const title = selectEl<HTMLHeadingElement>("#slide-title");
  const progress = selectEl<HTMLParagraphElement>("#slide-progress");
  const content = selectEl<HTMLDivElement>("#slide-content");
  const prevButton = selectEl<HTMLButtonElement>("#prev-slide");
  const nextButton = selectEl<HTMLButtonElement>("#next-slide");
  const saveMdButton = selectEl<HTMLButtonElement>("#save-md");
  const savePdfButton = selectEl<HTMLButtonElement>("#save-pdf");

  let markdown = "";
  let slides: Slide[] = [];
  let index = 0;

  saveMdButton.disabled = true;
  savePdfButton.disabled = true;
  prevButton.disabled = true;
  nextButton.disabled = true;

  const poll = async (): Promise<boolean> => {
    const status = await fetchJobStatus(currentJobId);
    statusLine.textContent = `${status.state}: ${status.message}`;

    if (status.state === "failed") {
      spinner.hidden = true;
      statusLine.textContent = `failed: ${status.error?.message ?? status.message}`;
      return true;
    }

    if (status.state !== "ready") {
      return false;
    }

    markdown = await fetchSlidesMarkdown(currentJobId);
    slides = parseSlides(markdown);

    spinner.hidden = true;
    deckRoot.hidden = false;
    saveMdButton.disabled = false;
    savePdfButton.disabled = false;

    renderSlide();
    return true;
  };

  const renderSlide = (): void => {
    if (slides.length === 0) {
      title.textContent = "No slides";
      progress.textContent = "0 / 0";
      content.innerHTML = "<p>No deck content returned.</p>";
      return;
    }

    const slide = slides[index];
    title.textContent = slide.title;
    progress.textContent = `${index + 1} / ${slides.length}`;
    content.innerHTML = "";

    for (const block of slide.blocks) {
      content.appendChild(renderBlock(block));
    }

    prevButton.disabled = index === 0;
    nextButton.disabled = index >= slides.length - 1;
  };

  const finish = await poll();
  if (!finish) {
    const timer = window.setInterval(async () => {
      try {
        const done = await poll();
        if (done) {
          window.clearInterval(timer);
        }
      } catch (error) {
        window.clearInterval(timer);
        statusLine.textContent = `error: ${error instanceof Error ? error.message : String(error)}`;
      }
    }, 1200);
  }

  prevButton.addEventListener("click", () => {
    if (index <= 0) {
      return;
    }

    index -= 1;
    renderSlide();
  });

  nextButton.addEventListener("click", () => {
    if (index >= slides.length - 1) {
      return;
    }

    index += 1;
    renderSlide();
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      prevButton.click();
    }

    if (event.key === "ArrowRight") {
      nextButton.click();
    }
  });

  saveMdButton.addEventListener("click", () => {
    saveMarkdown(markdown, `${currentJobId}.tour.md`);
  });

  savePdfButton.addEventListener("click", () => {
    savePdf();
  });
}

function shellMarkup(jobId: string): string {
  return `
    <main class="app-shell">
      <header class="hero">
        <p class="badge">Codebase Tour</p>
        <h1>Repository Walkthrough</h1>
        <p class="subline">job: ${escapeHtml(jobId)}</p>
      </header>

      <section class="status-panel">
        <div id="spinner" class="spinner" aria-label="Loading"></div>
        <p id="status-line">queued: waiting to start</p>
      </section>

      <section id="deck-root" class="deck" hidden>
        <div class="deck-head">
          <h2 id="slide-title"></h2>
          <p id="slide-progress"></p>
        </div>
        <article id="slide-content" class="slide-content"></article>
      </section>

      <footer class="controls no-print">
        <button id="prev-slide" type="button">Previous</button>
        <button id="next-slide" type="button">Next</button>
        <button id="save-md" type="button">Save Markdown</button>
        <button id="save-pdf" type="button">Save PDF</button>
      </footer>
    </main>
  `;
}

function renderBlock(block: SlideBlock): HTMLElement {
  if (block.type === "heading") {
    const heading = document.createElement(block.level === 2 ? "h3" : "h4");
    heading.textContent = block.text;
    return heading;
  }

  if (block.type === "paragraph") {
    const paragraph = document.createElement("p");
    paragraph.textContent = block.text;
    return paragraph;
  }

  if (block.type === "list") {
    const list = document.createElement("ul");
    for (const item of block.items) {
      const li = document.createElement("li");
      li.textContent = item;
      list.appendChild(li);
    }
    return list;
  }

  return renderSnippet(block.snippet);
}

function renderSnippet(snippet: SlideSnippet): HTMLElement {
  const wrapper = document.createElement("section");
  wrapper.className = "snippet";

  const meta = document.createElement("div");
  meta.className = "snippet-meta";

  const location = document.createElement("span");
  location.textContent = [snippet.path ?? "(path missing)", snippet.lines ? `lines ${snippet.lines}` : ""]
    .filter(Boolean)
    .join(" · ");
  meta.appendChild(location);

  if (snippet.permalink) {
    const link = document.createElement("a");
    link.href = snippet.permalink;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = "View on GitHub";
    meta.appendChild(link);
  }

  const pre = document.createElement("pre");
  const code = document.createElement("code");
  code.className = `language-${snippet.language}`;

  const highlighted = new Set(snippet.highlightLines);
  const lines = snippet.code.split("\n");

  lines.forEach((line, offset) => {
    const row = document.createElement("div");
    row.className = "code-line";
    if (highlighted.has(offset + 1)) {
      row.classList.add("highlight");
    }

    const lineNo = document.createElement("span");
    lineNo.className = "line-no";
    lineNo.textContent = String(offset + 1);

    const codeText = document.createElement("span");
    codeText.className = "line-text";
    codeText.textContent = line || " ";

    row.append(lineNo, codeText);
    code.appendChild(row);
  });

  pre.appendChild(code);
  wrapper.append(meta, pre);
  return wrapper;
}

function selectEl<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing element ${selector}`);
  }

  return element;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
