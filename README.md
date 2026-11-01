# PerioVox Web

Bilingual Spanish and English website for PerioVox: free voice periodontal charting for dental professionals. Built with React, Vite and Node.js 24.

## Development

```sh
npm ci
npm run build
npm start
```

The complete local site and Journal run at http://127.0.0.1:3201. Use `npm run dev` for the development server on port 3200.

At the production homepage, Spanish as the browser's primary language redirects to `/es/`; other languages use English at `/`. An explicit ES/EN selection is remembered. Language-specific URLs remain directly accessible for visitors and search engines.

## Deployment

The public website is deployed to Vercel using `vercel.json`. The Journal API, public articles, editorial interface, uploaded images and dynamic sitemap are served through a persistent Node.js origin. Keep the origin deployment and Vercel routes configured together.

The origin requires Node.js 24 and a private writable data directory **outside the deployment directory**. Set `JOURNAL_DATA_DIR` on the server. Optional `JOURNAL_ORIGIN`, `JOURNAL_INTERNAL_HOSTS` and `JOURNAL_ASSET_ORIGIN` configure the reverse proxy and public asset URLs.

The production-only `INDEXNOW_KEY` configuration publishes the ownership proof required by IndexNow at build time. With that variable available, run `node scripts/submit-indexnow.mjs` to notify participating search engines of the public sitemap URLs. Submission does not confirm indexing or rankings and does not replace Google Search Console.

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

## Scheduled publication

The editor offers immediate publication or a scheduled date/time in Europe/Madrid. Scheduling prepares and validates the Spanish/English content and metadata first, then persists a publication snapshot and UTC timestamp in SQLite. No AI/network call is required at the due time. The persistent origin checks due jobs every 15 seconds, on startup and on Journal requests; a hosting cron should request `/healthz` every minute so an idle/restarted origin is awakened without depending on an editor browser or computer. Publication is atomic and idempotent across workers. If the origin is unavailable, due jobs recover on its next successful check.

Scheduled content is private until due. Published articles remain live while a future update is pending. Saving edits cancels the old schedule so an outdated snapshot cannot publish; editors must schedule the updated version again. Cancellation and withdrawal remove pending jobs. Conflicting slugs and stale revisions are rejected. A private database backup is created before the first scheduling migration; the existing tables/data are preserved.
