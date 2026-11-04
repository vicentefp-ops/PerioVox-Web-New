# Journal offline export preparation

This tool **does not deploy, transfer data, import into a destination, or change the serving application**. It creates a private, verified logical backup for a future durable-storage migration. Vercel serverless local disk is not a durable replacement for this database and upload directory. The destination database/object storage adapter, authentication, scheduler, URLs, redirects and rollback must be implemented and tested before cutover.

## Requirements and boundaries

- Node.js 24, with its built-in `node:sqlite`; no new packages.
- Use a trusted machine and directories controlled exclusively by the operator. During an explicitly authorized change window, stop the Journal process, background workers, upload handlers and scheduled publication before the final export. The tooling itself does not freeze or stop any process. Keep them stopped through final comparison and cutover. `--offline` is an operator acknowledgement, **not a process lock**. Do not let another process rename directories during the operation.
- The source must have the current schema, including `schedules`. Older/unexpected schemas fail closed; do not run this preparation tool to upgrade them.
- Source application rows are queried read-only in a SQLite transaction, including committed WAL state. No `openStore`, migrations, checkpoint, scheduler, network calls or AI calls run. SQLite may use/update its normal shared-memory coordination sidecar; this is not a forensic byte-for-byte image of the complete runtime directory.
- Destination must be a new directory outside the source, under an existing trusted parent. Existing directories are never overwritten. Symlinks (including ancestors), hardlinks, nested upload directories, unknown runtime files and malformed upload names are rejected. New directories are mode 0700; package files are 0600. Use an encrypted disk; this package is private but **not encrypted**.

## Commands

Run from the repository root. Replace placeholders with trusted absolute paths outside the checkout. These commands are intentionally not added to package.json.

```sh
node scripts/journal-migration.mjs inventory /private/journal-data
# Stop ALL Journal writers and the publication scheduler before continuing.
node scripts/journal-migration.mjs export /private/journal-data /private/journal-export-NEW --offline
node scripts/journal-migration.mjs verify /private/journal-export-NEW
node scripts/journal-migration.mjs compare /private/journal-data /private/journal-export-NEW
node --test scripts/journal-migration.test.mjs
```

Commands output only JSON counts, fingerprints and upload paths/sizes/hashes. Failure output is deliberately generic so database errors cannot reveal content or secrets. Exit status is 1 on failure. For detailed local diagnosis, the exported JavaScript functions throw descriptive errors; do not publish arbitrary exception payloads from database APIs.

## Package contract: periovox-journal-offline-v1

- `journal.sqlite`: newly constructed database with `users`, `articles`, `revisions`, `schedules`, `slugs` and the `schedules_due` index. All column values are preserved exactly, including bilingual draft/publication JSON, revision IDs and counters, pending/failed schedule snapshots and UTC timestamps, and historical slug aliases. This is a logical backup, not a raw page copy.
- `uploads/`: all existing uploads, including unreferenced images, copied byte-for-byte using original filenames.
- `manifest.json`: creation timestamp, full SQLite SHA-256, deterministic table counts and row-set SHA-256 values, per-image sizes and SHA-256 values, format marker and exclusion policy. Rows are ordered by all columns before hashing, using the current JavaScript JSON representation. Fingerprints support comparison, not authenticity: an attacker able to replace the package and its manifest can replace both. Keep a trusted copy of the manifest separately when planning a transfer.

User email addresses, salts and password hashes exist **only in the private SQLite package**, never as values in the manifest/report. Treat the entire package and manifest as private. Do not commit them or upload them without appropriate authorization. The new database never contains session/rate-limit rows, even in free pages.

Excluded: `sessions`, `attempts`, `gemini.key`, `gemini-model.txt`, SQLite WAL/SHM files and historical `journal-before-scheduling-*.sqlite` backups. The tool recognizes these source files but does not transfer their contents. Gemini credentials must be provisioned separately only with action-time authorization. Existing editorial sessions will not carry over. The source database/key/backups stay in place for rollback; this export is **not a complete credential/disaster-recovery archive**.

Verification runs SQLite integrity/schema checks, validates article JSON, orphan relationships and scheduled timestamps/statuses, checks local media references in articles/revisions/schedules, and recomputes manifest/database/upload hashes. Export verifies its output and compares durable source state again before returning success. Drift or missing images fails the operation and removes the newly created incomplete package. A source that changes and changes back between checks is not detectable; writer quiescence is required. Inventory alone is a point-in-time observation, not a cutover guarantee.

## Before any future cutover

1. Record a final successful offline comparison and keep the original runtime directory untouched and privately backed up using the host's normal backup mechanism.
2. Implement and test the durable destination importer against this format. Preserve all keys and aliases; do not publish pending snapshots early. Decide how overdue schedules recover and ensure exactly-once publication across workers.
3. Validate counts, row fingerprints, media hashes, bilingual public URLs, aliases, drafts, authentication, editing and scheduling on the destination. Re-provision Gemini separately if authorized.
4. Only then switch traffic, verify production behavior and retain a documented rollback path. Never run both writable origins simultaneously. If production writes occur on the new destination, rollback needs reconciliation rather than blindly restoring the old source.

The included tests use temporary synthetic fixtures only. They exercise committed WAL content, exclusion of secrets/transient state, filesystem restrictions, tampering, missing media, malformed data/schema, source drift and private output permissions. They do not establish that the production source is complete or that a Vercel deployment exists.
