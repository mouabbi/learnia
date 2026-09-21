# 16 — Theming

## Purpose
Per-course visual identity (brand color, module colors, light/dark palettes) plus
global app-level light/dark mode, without breaking accessibility.

## Concepts that must be covered
1. Theme data shape: brand color, secondary/accent colors, module colors (array or map), heading/section colors, light-mode palette, dark-mode palette
2. Where theme data lives: embedded JSON column on `courses`, or a separate `themes` table? → likely a JSON column is fine (it's a cohesive, non-relational bundle)
3. Contrast/accessibility enforcement: validate generated colors against WCAG contrast ratios for text-on-background before accepting an AI-proposed palette
4. CSS variable strategy: course theme → CSS custom properties scoped to the course's views, app chrome stays on the global app theme
5. Global light/dark mode toggle (app-level, independent of course theme, using `prefers-color-scheme` + manual override)
6. Editing theme values in the CMS (color pickers, live preview) — no manual JSON editing

## Questions to answer before implementation
- Should an AI-proposed palette be auto-rejected/adjusted if it fails contrast checks, or just flagged with a warning for the user to fix manually in the CMS? → Recommend: validate and flag with a clear warning + suggested fix, but let the user make the final call in the theme editor — don't silently auto-mutate their AI-generated colors.
- Module colors: a fixed-size palette (e.g. up to N modules get distinct colors, cycling) or unlimited freeform per-module color assignment? → Recommend a generated palette of a reasonable set (e.g. 8-10 colors) that cycles/extends algorithmically, editable per-module afterward.

## Dependencies
- 05-course-system

## Implementation prompts that will eventually be required
1. Theme JSON schema (Pydantic model) + storage on course
2. Contrast/accessibility validation utility (WCAG check)
3. CSS variable injection (course theme → scoped custom properties at render time)
4. Global light/dark mode (app-level, toggle + persistence)
5. Frontend: theme editor UI in the CMS (color pickers, live preview against real components)

## Learning opportunities
- Design tokens / CSS custom properties as a theming mechanism
- Accessibility (WCAG contrast) as an enforced constraint, not an afterthought
- Scoped theming (per-course) coexisting with global app theme (light/dark)
