# Opt-in Journal migration to Vercel

## Status and boundaries

The user has requested the full migration. Deployment and eventual cutover belong to that request once the technical gates are satisfied; this preparation task itself is restricted to local changes. Additional confirmation is needed for concrete new credentials/persistent access, Gemini secret transfer, any paid plan, and the source stop/write-freeze, rather than repeated generic permission to migrate.

This branch prepares a migration. **It is not a completed production migration.** The default `vercel.json` remains the Hostinger proxy configuration. No production database, upload, credential, domain, deployment or billing setting has been changed. No external integration has been tested. Do not stop Hostinger or change production routing merely because local tests pass.

The destination requires a separately approved durable PostgreSQL database (Neon-compatible), a **private** Vercel Blob store, and an approved minute scheduler. SQLite and the persistent-origin timer remain supported and tested. Nothing automatically creates a database, copies production data, imports Gemini credentials or enables a paid plan.

## Implementation

- `server/journal-postgres-store.mjs` implements the existing store contract asynchronously using `pg`. Article modifications, slug checks, pending reservations and due publication share a PostgreSQL row lock and SQL transaction, so separate function instances cannot race through a slug reservation or overwrite an outdated revision. Per-job savepoints keep a failed scheduled publication from discarding successful jobs. Runtime opening checks the schema version and exact environment marker but never creates schema.
- `server/journal-http.mjs` accepts optional store/media/settings adapters. The default remains SQLite and private local uploads. Public/editor routes, draft snapshots, bilingual translation, metadata, revisions, historical slug redirects, cancellation and withdrawal are retained. Awaited operations support both store implementations.
- `api/journal.mjs` is disabled unless `JOURNAL_BACKEND=vercel`. It uses the existing SSR renderer and same-origin static assets. It has no persistent timer, file-backed database or local secret fallback. Initialization errors return generic responses without credentials or connection strings.
- Blob uploads use authenticated, CSRF-protected begin/chunk/complete endpoints. Requests carry at most 2 MiB of image bytes; total images still support 8 MiB. Short-lived signed tickets and chunk receipts are bound to the current session, and staging remains private. Completion verifies every byte hash and PNG/JPEG/WebP signature before writing a content-addressed final image. Public paths remain `/journal-media/<name>.<ext>`, including imported legacy UUID names. Serving uses streaming rather than buffering an 8 MiB response through the function response limit.
- Existing image bytes are not rewritten. Gemini cover analysis reads the same bounded bytes from private Blob or built-in static media. Gemini configuration can use explicitly scoped deployment secrets, or an AES-256-GCM encrypted database value behind the existing authenticated settings UI. A separate 32-byte encryption key is required for UI writes. No keys have been copied or generated.
- Shared PostgreSQL sessions and login counters work across warm/cold instances. Login identity uses Vercel's forwarded-client header only in the Vercel entry; local origin behavior remains unchanged. A real preview spoofing/rate-limit check is mandatory.

## Configuration, only after approval

Set variables through an approved secure credential flow, never in committed files or shell history. Do not put production storage credentials in Preview or Development scope.

Common: `JOURNAL_BACKEND=vercel`, `NODEJS_HELPERS=0` (the handler deliberately consumes bounded raw streams), Node.js 24.

Preview only:

- `JOURNAL_PREVIEW_DATABASE_URL`: isolated PostgreSQL connection URL, TLS enabled.
- `JOURNAL_PREVIEW_BLOB_TOKEN`: isolated **private** Blob store token.
- `JOURNAL_PREVIEW_ENVIRONMENT_ID`: unique identity beginning `preview:`, matching the database marker.
- Optional `JOURNAL_PREVIEW_SETTINGS_KEY`: 64 hexadecimal characters, supplied securely after explicit approval.
- Optional `JOURNAL_PREVIEW_GEMINI_API_KEY` and `JOURNAL_PREVIEW_GEMINI_MODEL`: no generic or production fallback. Synthetic/manual content works without Gemini.
- Vercel supplies the exact `VERCEL_URL`; requests to other hosts are rejected. Use the deployment hostname for preview testing, not a guessed alias.

Blob is also bound to the exact unique environment ID by a private marker checked before any runtime operation. Its marker must be explicitly provisioned into an empty store by the approved setup process; it is never created by runtime startup. A different token for the same wrong store still fails.

Production only uses corresponding `JOURNAL_PRODUCTION_*` names, environment identity beginning `production:`, and canonical `https://periovox.ai`. It additionally requires `CRON_SECRET` (at least 32 characters) and `JOURNAL_SCHEDULER_MODE=external-minute` or `vercel-pro-minute`. A label is not proof that a scheduler exists: verify the approved scheduler actually invokes the endpoint before cutover.

The environment marker is a second guard, not a substitute for database permissions. Preview cannot connect using only a production variable, rejects a production marker, and refuses equal production/preview credentials when both are present. Separate databases/tokens and deployment-scoped secrets are still mandatory. Never change a production marker to make preview startup pass.

## Explicit build and rollout

1. Run `npm ci`, `npm run lint`, `npm run build`, `npm run seo:check`, `npm run journal:check`, `npm run journal:vercel:check`, and `node --test scripts/journal-migration.test.mjs scripts/journal-import-postgres.test.mjs` in a clean checkout. Use `npm ci --cache /tmp/periovox-npm-cache` if the default cache is unavailable.
2. Resolve the specific storage, credential/persistent-access and cost approvals. Use an isolated empty test database/private Blob store, initialize the schema with its unique marker through the explicit importer, and import **synthetic** fixtures first. Schema/import tooling is described in `journal-offline-migration.md` and `journal-postgres-import.md`. No initialization happens in a function request.
3. Preview deploy only using the explicit alternate configuration (`vercel --local-config vercel.journal.preview.json`, in the rollout phase after the storage gates). Its build is `npm run build:vercel-journal`. Every preview path receives `X-Robots-Tag: noindex, nofollow`, and preview robots disallows crawling. Deployment Protection should also be enabled if approved, particularly before private data is ever copied. Noindex is not access control.
4. Verify all external gates below. Do not claim production readiness based on mocks or PGlite alone.
5. Obtain authorization for a private-data transfer and a scheduled freeze window. Stop **all** source writers and scheduler only in that approved window. Export and compare using the offline tool, preserving the original private source for rollback. Import into an empty production destination, verify exact durable table fingerprints and all upload byte hashes, and keep both source and destination writers disabled until cutover. Users retain password hashes but must sign in again; sessions/attempts are intentionally excluded.
6. Configure and verify approved scheduling. After storage/import/preview evidence are complete, deploy using `vercel.journal.production.json`. Verify every baseline article in both languages, HTML/canonical/hreflang/schema, historical redirects, both sitemaps, cover/body images, editor login, and scheduling. Keep the old origin and backup intact.
7. Reconcile any post-cutover writes before rollback. Simply pointing back to a frozen old database after new edits would lose changes. Freeze writes, export/compare the active destination, decide which authoritative data to restore, then perform the routing rollback within the authorized migration recovery scope. Never run both editors against divergent databases.

The alternate configs do not contain cron jobs. Do not copy them over default `vercel.json` before the cutover gates are complete. Choosing an alternate config in a CLI command deploys it; it is not a read-only dry run.

## Scheduling and maintenance

The persistent origin currently checks every 15 seconds and on requests. Serverless has no durable timer. An approved minute scheduler invokes `GET /api/journal/cron` with `Authorization: Bearer <CRON_SECRET>`. Requests also recover due jobs idempotently, but request-only recovery is **not** an acceptable replacement for idle scheduled publication.

Vercel Hobby cron runs at most daily and has coarse precision; Vercel Pro supports per-minute cron. The actual plan has not been verified. Do not add `* * * * *` or upgrade billing without approval. With verified Pro and approval, the production config can add `"crons": [{"path":"/api/journal/cron","schedule":"* * * * *"}]`. Alternatively, obtain approval for an external reliable minute scheduler. Both are best-effort, so verify late/repeated requests and monitor failures. The cadence changes from a 15-second origin check to a minute wake-up and must be accepted before cutover; do not silently degrade timing guarantees.

The authenticated cron also removes expired private staging objects after a one-hour retry grace period, never final media. Cleanup processes one bounded page per call; monitor staging volume and use the adapter cursor for additional authorized maintenance if necessary. Completed uploads retain staging until expiration so lost completion responses can be retried safely. Token rotation invalidates in-progress tickets; editors can restart uploads.

## External acceptance gates still unrun

- Actual Vercel build/function file tracing, Node 24 entry resolution, rewrite path behavior, raw body handling with helpers disabled, 300-second execution budget and same-origin asset delivery.
- Real Neon/PostgreSQL multi-connection contention and pool limits, enforced TLS, transaction rollback and reconnects. PGlite executes real PostgreSQL SQL locally, but its one connection does not prove distributed lock contention behavior.
- Actual private Blob `put/get/list/del` behavior and permissions, 8 MiB image streaming, HEAD/GET, interrupted chunks, retries on another cold instance, expiration cleanup and token rotation.
- Exact production backup/import hashes, existing editor login, all four baseline published articles/eight bilingual URLs and legacy upload URLs. Counts are observations from 2026-11-04, not a frozen transfer manifest.
- Preview-wide noindex, deployment access protection, no production DB/token/key references; forged Host/Origin/CSRF, forwarded-IP spoofing and rate limits.
- Real Gemini configuration only after approval, ES→EN translation, metadata/cover reading, provider timeout/failure and concurrent-edit preservation. No live provider calls were made.
- Verified plan or external scheduler, idle due publication, retry/duplicate delivery, failure alerting, backup/restore policy, storage costs, and an approved rollback exercise.

## Verified upstream constraints

Reviewed on 2026-11-04:

- Function request/response payload limit: https://vercel.com/docs/functions/limitations
- Streaming large responses: https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions
- Private Blob SDK: https://vercel.com/docs/vercel-blob/using-blob-sdk
- Cron plans/frequency: https://vercel.com/docs/cron-jobs/usage-and-pricing
- Disable Node helpers: https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration
- Forwarded request headers: https://vercel.com/docs/headers/request-headers

## Dependency security note

Vite is pinned to the locally incorporated 6.4.5 security update. The new Blob SDK currently brings `@vercel/oidc` 3.x, which pins vulnerable `@vercel/cli-config` 0.3.1/Zod. The package override selects the official patched `@vercel/cli-config` 0.3.6 (Zod >=4.6.6), addressing GHSA-mrhx-c7xc-m3w5 without downgrading Blob or forcing an OIDC major-version jump. Remove the override once the supported Blob dependency chain includes the patched release. Run `npm audit --audit-level=moderate` after future updates.
