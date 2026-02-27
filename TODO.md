# UI Stabilization TODO

- [x] 1. Use full horizontal screen space in viewer layout.
- [x] 2. Move controls to top-right; icon-only buttons for Previous/Next/Save Markdown; remove Save PDF.
- [ ] 3. Remove borders around slide containers; use full horizontal + vertical space.
- [ ] 4. Apply Solarized Light/Dark themes with automatic `prefers-color-scheme`; JetBrains Mono for all text; no theme toggle.
- [ ] 5. Show real code line numbers from snippet `lines` metadata (e.g., 3-9 renders 3..9).
- [ ] 6. Redesign commentary UX:
  - [ ] Code as primary content.
  - [ ] Overall comments rendered as markdown below code with collapse/expand control.
  - [ ] Per-highlight comment icon on right side of code line(s).
  - [ ] Clicking icon opens right-slide markdown comment window overlay.
  - [ ] Window supports close via outside click and top-right close button.
  - [ ] Window supports drag by title bar.
  - [ ] Window supports resize from bottom-right corner.
  - [ ] Multiple comment windows can be open at once.
