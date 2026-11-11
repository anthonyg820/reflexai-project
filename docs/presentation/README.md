# Interview summary presentation

Nine animated slides shown before the live demo, plus an optional appendix after it (bootstrap, Terraform modules, Terragrunt environments, databases, observability, GitHub Actions workflows; reach it with `→` past the demo slide, `End`, or the A buttons): the goal, what the RehearseAI app does (with a dashboard screenshot and how scoring works), the stack and architecture, one digest / one release (with GCP and AWS example files), the CI/CD flow, both problems and how they were fixed (with a slide on how the review policy works), and a "Time for a live demo" finale.

**Open it:** double-click `index.html` and press `F` for full screen. There's no build step, and it needs no network (fonts are in `fonts/`).

| Key | Action |
|---|---|
| `→` `space` `PageDown` / `←` `PageUp` | Next / previous slide |
| `1`–`9`, `Home`, `End` | Jump to a slide |
| `A` | Approve production on slide 5 (the image stops at the approval gate until you do) |
| Click a stage, or `Tab` + `Enter` | Slide 5: open that phase's details (the checks CI runs, the deploy steps, the canary…) |
| `↑` `↓` / `Esc` | Slide 5, details open: previous / next phase, close |
| `F` | Full screen |

- **Slide 4:** the GCP / AWS tabs switch the example release file (`←` `→` move between tabs while one is focused).
- **Slide 8 (Scenario A):** the Before / Side by side / After switch changes the view.
- **Links on the last slide:** they come from `links.example.js`. To add your Grafana dashboard, create `links.js` (git-ignored) with:

  ```js
  Object.assign(window.PRESENTATION_LINKS, { grafana: "https://<your-stack>.grafana.net/d/rehearse-overview" });
  ```

- **Not deployed:** this lives under `docs/`, which the Release workflow ignores, so it never deploys anywhere.
- **Motion:** respects the operating system's reduced-motion setting.
- **Dashboard screenshot** (`img/dashboard.webp`, slide 2): the dark-mode dashboard at 1440 px wide. Retake it if the dashboard changes.
