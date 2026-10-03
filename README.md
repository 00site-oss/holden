# Holden Heating and Cooling

- `index.html` is the whole site (single page).
- `/admin/` is the admin panel: dashboard, bookings, site content editor, team accounts.
- `content-defaults.json` holds the built-in homepage content. Anything published from the admin overrides it.
- API: `server/api.mjs`, deployed as the Netlify Function `netlify/functions/api.mjs` (`/api/*`). Data lives in Netlify Blobs.

## Admin panel
- First visit to `/admin/` asks you to create the **owner** account.
- Roles: **owner** (everything, including the team), **manager** (bookings, dashboard, site content), **technician** (view and update bookings).
- Optional env var `SESSION_SECRET`. If it's not set, a secret is generated and stored in Blobs.

## Local development
`docker compose -f docker-compose.alloy.yaml up`, then open http://localhost:3000. Local data goes in `.data/` (git-ignored).
