# Offline PostgreSQL and private Blob import

This is operator tooling, not an automatic startup migration. No command below has been run on real data. Obtain approval for the exact private-data transfer, destination database and private Blob store before use. The full migration is requested, but concrete additional confirmation is required to provision credentials/persistent access, accept new costs or transfer Gemini secrets. Production traffic must wait for the documented technical acceptance gates. The importer never copies Gemini keys, active sessions or rate-limit records.

## Preconditions

1. Follow `journal-offline-migration.md`: stop **all** source writers and the scheduler, export and compare, keep a private original backup. Keep the source stopped through final comparison/cutover. Use trusted, operator-controlled directories with no concurrent modifications.
2. Provision an **isolated** PostgreSQL database and **private** Vercel Blob store through an approved workflow. Confirm their actual identities; a distinct token is not proof that two Blob stores are different. Never use production storage for preview tests. Through a separately approved initialization step, call `initializeBlobEnvironment({sdk,token,environment:environmentId})` from `server/journal-blob-media.mjs` to create the private `journal-environment.json` marker with the exact same identity as PostgreSQL. Initialization must never overwrite an existing marker. Both import and verification require this marker before accessing any media; neither creates it lazily. A missing or mismatched marker aborts.
3. Explicitly initialize the schema with `initializePostgresSchema(pool, environmentId)` from `server/journal-postgres-store.mjs`, using a unique identity such as `preview:<approved-project-id>` or `production:<approved-project-id>`. This does not run during runtime startup or import. The importer refuses a missing/mismatched environment marker or any durable/transient/settings rows. Initializing or importing a database is an external write and must be separately authorized.
4. Configure the **operator process only** with `JOURNAL_DATABASE_URL`, `JOURNAL_ENVIRONMENT_ID`, and `BLOB_READ_WRITE_TOKEN` through an approved secret mechanism. These names are importer-specific; runtime preview/production environment variables are separate. Do not put secrets on the command line, in logs or in shell history. Do not print connection errors.

## Commands after approval

```sh
# Setup is a real external write. Run only against the approved isolated stores.
node scripts/journal-storage-setup.mjs --confirm-isolated-storage-setup
node scripts/journal-migration.mjs verify /private/export
node scripts/journal-import-postgres.mjs import /private/export --confirm-private-data-transfer
node scripts/journal-import-postgres.mjs verify /private/export --confirm-target-read
node scripts/journal-migration.mjs compare /private/original /private/export
```

The confirmation flags acknowledge the operation; they are not a substitute for authorization or a writer lock. CLI output includes only a source fingerprint, target row counts and image count. Errors are intentionally generic. Do not publish arbitrary exceptions raised by the JavaScript APIs; driver errors may contain private values.

The importer preserves all `users`, `articles`, `revisions`, `schedules` and `slugs` column values and IDs, including credential hashes, raw JSON, pending/failed schedules and historical aliases. It resets the revision sequence to prevent future collisions. PostgreSQL BIGSERIAL readback is normalized to the safe integer representation used by the SQLite exporter. Target rows are compared using the original SQLite row order, avoiding differences between database collations.

Each image is read from the verified package, checked for size/signature/extension, and stored with its **original filename** at `journal-media/<filename>` in private Blob storage. Existing image paths and article JSON remain unchanged. Copy uses `allowOverwrite:false`, then reads back and hashes actual bytes with cache disabled. An existing exact match is reused. Different content under the same name aborts; nothing is overwritten or deleted. Files outside the existing PNG/JPG/WebP, 1-byte to 8-MB application contract must be resolved before cutover rather than silently discarded.

All database rows are inserted and verified inside one transaction under the same durable lock used by editorial writes. Media copies happen first. A partial media failure leaves the database empty and completed private objects reusable. A database failure rolls back its rows, retaining copied media for a retry. PostgreSQL sequence changes are not transactional, but each import resets the sequence to the actual imported maximum. Never retry blindly after a lost response or uncertain commit: run `verify` first. A completed database intentionally refuses another import, even of the same package. Use `verify` to establish successful completion.

Verification does not publish due jobs, call Gemini, provision resources or switch routes. For exact fingerprints, keep the destination unpublished and do not run its scheduler/editor until verification finishes: any legitimate publication or edit changes the data. Configure and verify the approved scheduler before cutover. A test clone must not accidentally publish into a production database. Once writes occur on the new production origin, rollback requires reconciliation, not blindly reviving the old source.

## Tests and remaining gates

```sh
node --test server/journal-postgres.test.mjs scripts/journal-import-postgres.test.mjs
```

The tests use synthetic SQLite bundles, an in-memory real PostgreSQL engine (PGlite), and fake private Blob storage. They verify exact import/readback hashes, credentials, URLs/aliases, revision sequence, schedules, target refusal, partial-copy retry, tampering and DB rollback. PGlite has one connection; its test pool serializes leases, so these tests do **not** prove multi-connection PostgreSQL lock contention or live Neon/Blob SDK/network behavior. Validate both in isolated staging with separate approved credentials, including interrupted transfer, uncertain commit verification and cross-worker edit/publication races. An actual source backup, storage permissions and billing, public URL parity, authenticated editor flows, scheduling latency, production cutover and rollback remain deployment gates.
