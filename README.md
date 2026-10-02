# Holden Heating and Cooling

- `index.html` is the whole site (single page).
- `/admin/` opens the site in an editor. Click text to type, click images to replace, press Save & publish.
- Saves go to Netlify Blobs via `netlify/functions/content.mjs`; the live site updates instantly. No download, no redeploy.
- Setup: set the `ADMIN_PASSWORD` environment variable in Netlify, then trigger a deploy.
