import "./style.css";
import "./print.css";

import { fetchJobStatus, fetchSlidesMarkdown } from "./api";
import { saveMarkdown } from "./export";
import { parseSlides, type Slide } from "./markdown";
import { renderSlideContent } from "./slide-view";

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

  let markdown = "";
  let slides: Slide[] = [];
  let index = 0;
  let disposeSlideContent = () => {};

  saveMdButton.disabled = true;
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

    renderSlide();
    return true;
  };

  const renderSlide = (): void => {
    disposeSlideContent();

    if (slides.length === 0) {
      title.textContent = "No slides";
      progress.textContent = "0 / 0";
      content.innerHTML = "<p>No deck content returned.</p>";
      disposeSlideContent = () => {};
      return;
    }

    const slide = slides[index];
    title.textContent = slide.title;
    progress.textContent = `${index + 1} / ${slides.length}`;
    disposeSlideContent = renderSlideContent(content, slide);

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
}

function shellMarkup(jobId: string): string {
  return `
    <main class="app-shell">
      <header class="hero">
        <div class="hero-copy">
          <p class="badge">Codebase Tour</p>
          <h1>Repository Walkthrough</h1>
          <p class="subline">job: ${escapeHtml(jobId)}</p>
        </div>
        <nav class="controls no-print" aria-label="Slide controls">
          <button id="prev-slide" type="button" aria-label="Previous slide">
            ${iconChevronLeft()}
          </button>
          <button id="next-slide" type="button" aria-label="Next slide">
            ${iconChevronRight()}
          </button>
          <button id="save-md" type="button" aria-label="Save markdown">
            ${iconDownload()}
          </button>
        </nav>
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
    </main>
  `;
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

function iconChevronLeft(): string {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>`;
}

function iconChevronRight(): string {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>`;
}

function iconDownload(): string {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v10m0 0l4-4m-4 4l-4-4M5 18h14" /></svg>`;
}
