# AGENTS.md

## Cursor Cloud specific instructions

This repository is a **single static, client-side web app** — there is no backend, no build step, no package manager, and no test/lint tooling.

- Source files: `index.html` (the entire app — markup, CSS, and JS are inline), `logo.jpg` (brand/fallback image), `images.json` (a standalone data dump that the page does **not** load at runtime).
- All app data lives **inline in `index.html`** as the `MENU_DATA` and `IMG_MAP` JS constants. Editing `images.json` has no effect on the running page.
- The app (`sandton.garden`) is a Persian / RTL restaurant menu + cart. Cart and per-item image overrides are persisted in the browser via `localStorage` (`sandton_cart`, `sandton_img`).

### Run it (development)

Serve the repo root over HTTP and open `index.html` (must be over `http://`, not `file://`, so `localStorage`/clipboard behave):

```
python3 -m http.server 8000
```

Then open `http://localhost:8000/index.html`. Node alternatives like `npx serve` work too.

### Gotchas

- Admin mode (lets you edit item images) is enabled with the query param `?admin=1`, e.g. `http://localhost:8000/index.html?admin=1`.
- Food images are loaded from **external CDN URLs** baked into `IMG_MAP`; some may fail to load (broken-image icon) when those third-party hosts are unreachable. This is expected and not an environment problem; items with no/failed image fall back to `logo.jpg`.
- Cart state survives reloads via `localStorage`. If the cart shows unexpected leftover items, clear site data / `localStorage` for `localhost:8000` to start fresh.
- There are no automated tests, lint, or build commands. The only inline checks are a couple of `console.assert` self-tests in the cart code (visible in the browser console).
