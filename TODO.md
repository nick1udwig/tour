# UI Stabilization TODO

- [x] 1. Use full horizontal screen space in viewer layout.
- [x] 2. Move controls to top-right; icon-only buttons for Previous/Next/Save Markdown; remove Save PDF.
- [x] 3. Remove borders around slide containers; use full horizontal + vertical space.
- [x] 4. Apply Solarized Light/Dark themes with automatic `prefers-color-scheme`; JetBrains Mono for all text; no theme toggle.
- [x] 5. Show real code line numbers from snippet `lines` metadata (e.g., 3-9 renders 3..9).
- [x] 6. Redesign commentary UX:
  - [x] Code as primary content.
  - [x] Overall comments rendered as markdown below code with collapse/expand control.
  - [x] Per-highlight comment icon on right side of code line(s).
  - [x] Clicking icon opens right-slide markdown comment window overlay.
  - [x] Window supports close via outside click and top-right close button.
  - [x] Window supports drag by title bar.
  - [x] Window supports resize from bottom-right corner.
  - [x] Multiple comment windows can be open at once.
