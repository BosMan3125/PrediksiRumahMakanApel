# AGENTS.md

## Project overview

This repository is a simple Express + MySQL web app for a restaurant ordering and management system. The backend lives in `server.js`, and the frontend is a set of static HTML/CSS/JS pages under `public/`.

Important context for AI agents:
- Keep the existing architecture: server-side routes in `server.js`, static assets in `public/`, session-based auth, and direct MySQL queries.
- Prefer small, local changes over framework migrations or major refactors.
- Antigravity principle: avoid introducing heavy client-side patterns, new build tooling, or broad rewrites unless the task explicitly requires them.

## Absolute essentials

- App entry point: `server.js`
- Static frontend: `public/`
- Uploads directory: `public/uploads/paket/`
- Package manifest: `package.json`

## How this app is structured

- `server.js` owns the API routes, database connection, upload handling, and session setup.
- `public/*.html` are mostly standalone pages for owner/customer flows.
- Page-specific logic is usually in matching files under `public/js/`.
- The project is not a modern SPA; it is a conventional server-rendered/static-site app with AJAX calls.

## Development and validation

- Install dependencies: `npm install`
- Start the app: `node server.js`
- Quick syntax check: `node --check server.js`
- There are no automated tests configured in `package.json`; validation is usually via a server smoke test and manual page/API checks.

## Conventions for edits

- Maintain compatibility with the existing MySQL schema and table names.
- Keep session keys and user roles aligned with the current auth flow (`pemilik` and `pelanggan`).
- When editing APIs, preserve the existing JSON response shape unless a task explicitly requires a breaking change.
- For HTML/JS changes, keep behavior aligned with the matching page scripts in `public/js/`.
- Do not change upload constraints or file handling without checking the multer config in `server.js`.
- Be careful with database-side stock updates and order flows; those are business-critical and sensitive to logic errors.

## Safe working patterns

- Read the relevant route and matching frontend script together before editing.
- If a feature spans multiple pages, keep the backend request names and frontend payload fields consistent.
- If you add new endpoints, add or update the frontend call site in the corresponding page script.
- Prefer reusable helper logic in `server.js` over duplicating query logic across routes.

## Common pitfalls

- Session login state is stored in `req.session.user`; do not break role checks or redirects.
- Static files are served from `public/` with `express.static('public')`; browser paths should match the file names used in the HTML.
- The database is configured directly in `server.js` with `localhost` and `databaseprma`; environment variables are not currently used.
- Image uploads are restricted to a specific set of MIME types and a 5MB limit in the multer config.

## When asked to implement features

- Prefer the smallest viable change that fits the current server/static architecture.
- Reuse existing page patterns and naming conventions rather than introducing new abstractions.
- Keep the code understandable for a small team working on a classic Express app, not a framework-heavy app.

## Antigravity reminder

When a task starts to drift toward a large framework, new build pipeline, or a large refactor, stop and ask whether a simpler server-side fix is enough. This codebase is intentionally lightweight and should stay that way unless the task clearly requires otherwise.
