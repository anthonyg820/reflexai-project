# Interview summary presentation

Six animated slides shown before the live demo: the goal, the stack and architecture, the CI/CD flow, both problems and how they were fixed, and a "Time for a live demo" finale.

**Open it:** double-click `index.html` and press `F` for full screen. There's no build step, and it needs no network (fonts are in `fonts/`).

| Key | Action |
|---|---|
| `→` `space` `PageDown` / `←` `PageUp` | Next / previous slide |
| `1`–`6`, `Home`, `End` | Jump to a slide |
| `A` | Approve production on slide 3 (the image stops at the approval gate until you do) |
| `F` | Full screen |

- **Slide 4:** the Before / Side by side / After switch changes the view.
- **Links on the last slide:** they come from `links.example.js`. To add your Grafana dashboard, create `links.js` (git-ignored) with:

  ```js
  Object.assign(window.PRESENTATION_LINKS, { grafana: "https://<your-stack>.grafana.net/d/rehearse-overview" });
  ```

- **Not deployed:** this lives under `docs/`, which the Release workflow ignores, so it never deploys anywhere.
- **Motion:** respects the operating system's reduced-motion setting.
