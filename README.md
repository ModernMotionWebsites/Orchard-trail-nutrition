# Orchard Trail Nutrition — website

This folder is the complete public website, ready to host anywhere. No database, no
server, no build step: double-click `index.html` and the page renders (only the visit
counter needs a server, and it fails silently offline).

| File | What it is |
| --- | --- |
| `index.html` | the whole page — 156 drinks, seasonal board, hours, photos |
| `styles.css` | the design |
| `app.js` | menu filters, open/closed hours, photo lightbox |
| `assets/`, `media/` | every photo the page uses |
| `robots.txt`, `sitemap.xml` | for search engines |
| `.nojekyll` | tells GitHub Pages to serve the files untouched |

## Upload to GitHub Pages

1. Create a repository (e.g. `orchard-trail-nutrition`).
2. **Add file → Upload files**, then drag **the contents of this folder** in — not the
   folder itself — and commit.
3. **Settings → Pages → Source: Deploy from a branch → `main` / `root` → Save.**
4. Wait a minute. The site is live at `https://<your-username>.github.io/<repo>/`.

This folder also works unchanged on GoDaddy, Netlify, Vercel, Cloudflare Pages, or a USB
stick — it uses only relative paths.

## Updating it

The page is generated from the dashboard (`../godaddy/`, the PHP edition on GoDaddy).
After publishing there, rebuild this folder with:

```
node ../tools/build-static.mjs ../static-content.json .
```

or just ask for a fresh copy.

## Note

This folder is the website only. The editing dashboard needs PHP + MySQL, so it is not
part of this folder — it lives in `../godaddy/` and runs on GoDaddy Web Hosting.
