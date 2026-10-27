# Requester details in older rights-request audit entries

Dated 26 October 2026. A one-off maintenance script for databases created
before this date, hosted or self-hosted.

## What it clears

Older releases wrote the requester's details into two audit tables:

| Table | Entries | Column | Keys |
|---|---|---|---|
| `audit_logs` | `entityType = "DSARRequest"`, mainly `action = "CREATE"` from staff-entered requests | `changes` (and `metadata` if present) | `requesterName`, `requesterEmail`, `requesterPhone`, `requesterAddress`, `relationship`, `description`, `requestedData` |
| `dsar_audit_logs` | `action = "REQUEST_CREATED"` (releases before March 2026) | `details` | `requesterEmail` |

No screen shows these values: the organisation's audit trail and its CSV
withhold the detail of rights-request entries, and the platform operators'
audit views now do the same. Current code no longer writes them. The
`audit_logs` entries outlive a request deleted by hand and, for organisations
deleted before the deletion service removed their trail, have
`organizationId = null`.

`scripts/redact-dsar-audit-requester.ts` replaces only those keys with the
marker `[removed 2026-10]`. It deletes no row and keeps action, entity ids,
user ids, timestamps and every other key. It never reads or writes any other
entity type. A second run finds nothing.

## How to run it

1. **Create a backup branch of the database first.** On the hosted service,
   create a Neon branch of the production database from its current state
   (for example `backup-before-dsar-audit-redaction-2026-10`) and keep it until
   the result has been checked. On a self-hosted bundle, run `./backup.sh`.
2. Point `DATABASE_URL` at the database for this run only, and always use
   the npm script, so that `scripts/assert-safe-db.ts` checks the address.
3. Dry run (reads only; prints per organisation id the rows found and the
   names of the fields that would be cleared, with counts):

   ```
   npm run db:redact-dsar-audit-requester -- --dry-run --all
   ```

4. Redact:

   ```
   npm run db:redact-dsar-audit-requester -- --confirm --all
   ```

5. Run the dry run again: it must report 0 rows.

`--org <id-or-slug>` (repeatable) limits the run to named organisations
instead of `--all`; only `--all` covers the entries of deleted organisations.
Exactly one of `--dry-run` or `--confirm` is required. Each organisation is
redacted in its own transaction (maxWait 20 s, timeout 120 s). The JSON log
(`./redact-dsar-audit-requester-<timestamp>.json`, or `--log <path>`) holds
counts, organisation ids, row ids and field names, never a value.
