# lab2scale CRM

An accounts-first CRM: open a signed account, find real contacts at real target
companies, surface warm-intro paths through our network, and draft (never send)
the outreach email.

> **Guardrail:** the app never sends email, credentials are keyless (ADC only),
> the Anthropic key stays server-side, and login is restricted to the lab2scale
> Google domain. See the internal build guidance for the full list.

## Stack

- React + Vite + TypeScript + Tailwind + shadcn/ui
- Express API, single container (serves the API in dev and the static build + API
  in prod)
- Google Sheets as the datastore (via a service account, ADC — no key file)
- Claude API for the finder / warm-path / drafter / ranker agents

## Run it locally

Requires Node 20+.

```bash
git clone https://github.com/kope-kope/lab2scale-crm.git
cd lab2scale-crm
npm install
npm run dev
```

- App:  http://localhost:5173
- API:  http://localhost:8080/api/health

`npm run dev` runs the Vite dev server and the Express API together; the dev
server proxies `/api` to the API so the browser only talks to one origin.

## Other scripts

```bash
npm run build       # type-check + production build into dist/
npm start           # serve the production build + API from one process
npm run typecheck   # tsc, no emit
```

## Project layout

```
src/                React app
  components/        UI (layout + shadcn primitives)
  pages/             Accounts, Account detail, placeholders
  data/              placeholder data (replaced by the Sheets layer in Phase 1)
server/             Express API (single-container entry)
tailwind.config.ts  design tokens — the single source of truth for color
```

## Status

Phase 0 (foundations/scaffold) is in place: app shell, Accounts + Account detail
screens, design tokens, single-container server, dev/prod builds green. Google
Sheets data layer, auth gate, and the Claude agents are next.
