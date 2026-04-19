# Copilot instructions for MonPFE repo

This file gives concise, project-specific guidance for AI coding assistants working on this repository.

## Big picture
- MonPFE is a two-part app: a React + Vite frontend in `client/` and an Express API server in `server/`.
- Frontend talks to the backend via REST endpoints under `/api/*` (see `server/server.js`). The frontend API base URL is controlled by `VITE_API_URL` in the client environment (`client/src/lib/api.js`).
- The server uses a local SQLite DB accessed via `server/db.js` (imported in `server/server.js`). Most business logic and persistence live in `db.js`.

## Start / build / dev commands
- Frontend (client):
  - Dev: `npm run dev` in `client/` (uses Vite).
  - Build: `npm run build` in `client/`.
  - Preview: `npm run preview` in `client/`.
- Backend (server):
  - Start: `npm start` in `server/` (runs `node server.js`).

If running both locally, start the server first (default port 3000), then run the client dev server. Set `VITE_API_URL` to the backend URL when needed.

## Project-specific patterns and conventions
- Routes and validation: `server/server.js` performs lightweight param validation (helper functions `isEmail` / `isPassword`). Follow existing response shapes: `{ errors: [...] }` on failure and JSON on success.
- Role strings: the app expects roles exactly `student`, `professor`, or `administrator` (see signup/login validation). Preserve these literals when adding role checks or seeds.
- DB access: the `db.js` module exposes many helpers (e.g., `createUser`, `findUserByEmail`, `upsertReport`, `listMessages`). Prefer using these helpers rather than raw SQL in new server routes.
- Frontend routing: `client/src/App.jsx` uses a simple internal `page` state (no router). Add UI pages under `client/src/pages/` and import them into `App.jsx` following existing patterns.
- API calls: use `client/src/lib/api.js` helpers. If adding endpoints, mirror the `ok/data` return shape used by `signup`/`login`.

## Integration points & external deps
- Backend dependencies are in `server/package.json`: `express`, `better-sqlite3`, `bcryptjs`, `cors`, `dotenv`.
- Frontend uses `react`, `react-dom`, and `vite` (see `client/package.json`).
- Static asset: place `logo.png` in `client/public/` (see `client/public/README.md`) to be served at `/logo.png`.

## Testing & debugging notes (discoverable)
- No test runner is present; focus on manual verification: start server (`node server.js`) and call endpoints (e.g., `GET /api/`) or run client dev server and exercise UI flows.
- Server logs errors to console; reproduce flows (signup/login/admin APIs) to observe errors.

## Files to inspect when making changes
- API surface and validations: `server/server.js`
- DB layer: `server/db.js`
- Frontend entry: `client/src/main.jsx` and `client/src/App.jsx`
- Frontend API helpers: `client/src/lib/api.js`
- Client pages: `client/src/pages/` (including `admin/` and `student/` subfolders)

## Examples (copyable patterns)
- Add a backend route that returns JSON and uses helper functions:

```js
// in server/server.js (follow existing style)
app.get('/api/defense', (req, res) => {
  const email = (req.query.email || '').toLowerCase();
  if (!isEmail(email)) return res.status(400).json({ errors: ['Email invalide'] });
  return res.json(getDefenseByEmail(email) || null);
});
```

- Call backend from frontend using `client/src/lib/api.js` shape:

```js
// from a component
import { login } from '../lib/api.js';
const { ok, data } = await login({ email, password, role });
if (!ok) { /* handle data.errors */ }
```

## When unsure, ask the user about:
- Expected `VITE_API_URL` when running frontend against a remote server.
- Any seed data or credentials required for admin flows.

---
If this is helpful, I can refine sections (e.g., expand `db.js` helper list, add example environment variables, or include commit/PR conventions). What would you like improved or added?
