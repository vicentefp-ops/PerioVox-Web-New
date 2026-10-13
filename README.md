# PerioVox Web

Bilingual Spanish and English website for PerioVox: free voice periodontal charting for dental professionals. Built with React, Vite and Node.js 24.

## Development

```sh
npm ci
npm run build
npm start
```

The complete local site and Journal run at http://127.0.0.1:3201. Use `npm run dev` for the development server on port 3200.

## Deployment

The public website is deployed to Vercel using `vercel.json`. The Journal API, public articles, editorial interface, uploaded images and dynamic sitemap are served through a persistent Node.js origin. Keep the origin deployment and Vercel routes configured together.

The origin requires Node.js 24 and a private writable data directory **outside the deployment directory**. Set `JOURNAL_DATA_DIR` on the server. Optional `JOURNAL_ORIGIN`, `JOURNAL_INTERNAL_HOSTS` and `JOURNAL_ASSET_ORIGIN` configure the reverse proxy and public asset URLs.

Articles, credentials, sessions, uploads and Gemini settings are private runtime data. Never commit or expose `.journal-data`, `.env` files, deployment credentials or migration keys. Back up persistent data before updating the origin. The encrypted migration bootstrap is used only for the initial transfer and never overwrites an existing database.

## Journal

The editorial interface is `/journal/admin/`. Public articles are available at `/es/journal/` and `/journal/`. Editors use title, subtitle and a visual text editor. Gemini can translate Spanish articles into English and generate missing SEO and cover-image descriptions. Generated text remains editable; existing manual values are preserved.

## Verification

```sh
npm run lint
npm run build
npm run seo:check
npm run journal:check
```

The checks cover static HTML, metadata, language links, sitemap, links and assets, consent-aware analytics, authentication, publication snapshots, concurrent edits, translation, rich text and safe migration. Local checks do not demonstrate indexing, traffic or real-user performance.
