# Capacity: what one instance can carry, what breaks first, how it scales

Numbers here are derived from the code and the hosting shape, with the
reasoning shown. Where nothing in the tree supports a number, the cell says
"unknown, to measure" rather than guessing. Dated 14 September 2026.

## The two shapes

| | Hosted service | Self-hosted bundle (`deploy/sovereign`) |
|---|---|---|
| Application | Serverless functions on the hosting platform, one Node process per function instance, scaled by the platform | One Node process (`next start`, standalone build) in one container |
| Database | Managed serverless Postgres, one dedicated database; compute can be suspended when idle and takes seconds to wake (the Prisma client retries transient errors for about 6 s) | Postgres 16 container on the same machine, default `max_connections` 100 |
| Connection pooling | Unknown whether `DATABASE_URL` points at the provider's pooled endpoint or the direct one; to check in the hosted environment | Prisma's default pool per process: `2 × CPU cores + 1` connections |
| Rate-limit and health-cache state | In memory, per function instance | In memory, one process, so one global limit |
| Sessions | Stateless JWT cookies, no server store | Same |
| Scheduled work | Platform cron calls the retention route daily | A scheduler container calls it daily |
| Files | None on disk: PDFs are rendered on request and streamed; licence files are parsed and discarded; there is no upload store | Same |

## Per-instance ceiling, defended from the code

| Dimension | Ceiling | Reasoning |
|---|---|---|
| Organisations per instance | Hosted: roughly 250 to 500 before the nightly retention job outgrows a default function timeout. Self-host: thousands; not the binding limit | The retention route (`src/app/api/cron/dsar-redaction/route.ts`) loads every organisation and, for each, runs at least two queries sequentially (intake form, expired requests). At about 20 to 40 ms per query on a serverless database that is 40 to 80 ms per organisation, so 250 organisations is 10 to 20 s of wall time, which is the default function timeout range on the hosting platform's smaller plans. Beyond that the job is cut off part-way and the remaining organisations are not redacted that night (they catch up the next night only if the job gets further). On the bundle there is no function timeout; the job runs to completion. |
| Users per organisation | No code limit. Membership lists and pickers paginate; the auto-join by e-mail domain adds one row per sign-in. Practically unbounded for a firm | No unpaginated query over members was found. The role gate resolves one membership row per request. |
| Documents (assessments, processing records, DSARs, vendors, incidents) | No code limit; every list surface paginates. Bound by database size and by the export routes (below) | Records are rows with JSON columns; the largest single object is an assessment (sections and answers as JSON). The vendor catalog is about 900 rows shared by all tenants. |
| Requests per minute, ordinary pages and tRPC | Hosted: scales with function instances; the database is the shared limit (see "what breaks first"). Self-host: unknown, to measure; a single Node process typically serves on the order of a few hundred light requests per second, so a 20-user firm is nowhere near it | No load test exists in the tree. Each dashboard request resolves the session (JWT, no query), the membership (one query) and the page's own queries. |
| PDF exports | 10 per minute per user (limiter in `src/lib/api-export.ts`); each render is CPU-bound, typically 1 to 5 s, more with flow diagrams (Graphviz WASM plus SVG rasterisation) | The limiter exists because a render holds a CPU core; on the bundle, a handful of concurrent exports saturate the one process and slow every other user for those seconds. On hosted, each export is its own function invocation, so it competes for the platform's concurrency and timeout, not with other users' pages. |
| Public DSAR intake | 5 submissions per 10 minutes per client address; each submission may send a confirmation e-mail | Limiter in the middleware; the e-mail provider's own quota is the outer bound (unknown, to check in the provider console). |
| Sign-in | 10 attempts per minute per client address; 5 magic-link e-mails per 15 minutes per client address | Middleware limiters. Per process: on hosted, per function instance. |
| Health probes | 60 per minute per client address; one database query per 10 s regardless of probe volume | Middleware limiter plus the cache in `src/lib/health-probe.ts`. |
| Memory, self-host | Unknown, to measure. Expect a few hundred MB idle for the standalone server, plus a spike of tens of MB per concurrent PDF render | Not measured in the tree. The container has no memory limit set in the compose file. |

## What breaks first

In order of likelihood as load grows:

1. **Database connections on the hosted service.** Every function instance
   opens its own Prisma pool. With N warm instances the database sees N pools.
   On the serverless database's direct endpoint the connection cap is in the
   low hundreds; a burst of instances (a busy morning, a crawler on the public
   DSAR pages) can exhaust it, at which point requests fail with "too many
   connections" and the retry wrapper only delays the failure. **Mitigation
   already in place:** none beyond retries. **Fix:** point `DATABASE_URL` at
   the provider's pooled endpoint (transaction pooling), which multiplexes
   thousands of client connections onto a small server pool. This is a
   configuration change in the hosted environment, not a code change.
2. **The nightly retention job on the hosted service**, at a few hundred
   organisations (table above). **Fix:** either raise the function's maximum
   duration for that route or, better, process organisations in batches with a
   cursor and have the schedule call the route several times, each batch
   short. The route already reports a per-run summary, so a batched version
   can log where it stopped.
3. **Cold starts.** When the hosted database has been idle its compute is
   suspended; the first request after that waits several seconds. The Prisma
   wrapper retries for about 6 s, which covers most wake-ups on small tiers
   but not all. A visible first-paint delay, not an outage. **Fix:** a database
   tier that does not suspend, or a keep-warm ping; both are hosting choices.
4. **CPU on the self-hosted bundle** under concurrent PDF exports. One
   process, one event loop; renders block it. **Mitigation in place:** the
   per-user export limiter. **Fix if a firm hits it:** run a second app
   container behind the TLS profile's proxy (see "scaling plan"), which also
   requires the shared limiter store.
5. **Rate-limit counters on the hosted service** are per instance, so the
   ceilings are soft: an attacker spread across many instances gets the limit
   multiplied. They still cap the damage per instance and per address. **Fix:**
   the shared store below.

## Hosted scaling plan

What replaces what, when the hosted service outgrows the current shape. Each
step is independent and can be taken in the order the symptoms appear.

| Concern | Today | Replacement | Trigger |
|---|---|---|---|
| Database tier | Serverless Postgres, small compute that suspends when idle | The provider's next compute size with autoscaling and no idle suspension; read replicas are not needed (the workload is write-light and per-tenant) | Cold-start complaints, or sustained CPU on the database above about 60 % |
| Pooling | Unknown (direct or pooled endpoint; to check) | The provider's pooled endpoint in transaction mode; Prisma with `pgbouncer=true` and a modest per-instance pool (`connection_limit` of 3 to 5) | Any "too many connections" error, or more than about 20 concurrent function instances |
| Storage | Database only, no file store | Still none: PDFs stay on-demand. If stored exports are ever wanted, an object store with per-tenant prefixes and signed, expiring links, never the database | A product decision, not a load symptom |
| Per-process state: rate-limit counters | In memory per instance | A shared store: a small Redis (or the database itself: one `rate_limit_hits` table keyed by bucket and address, with a daily clean-up), behind the same `RateLimiter` interface in `src/lib/rate-limit.ts` so the middleware does not change | When abuse is observed to spread across instances, or before any public launch that expects hostile traffic |
| Per-process state: health cache | In memory per instance | Leave as is: the cache only needs to protect the database from one instance's monitors, which it does | never |
| Per-process state: Prisma client singleton | One pool per instance | Unchanged, but sized down once the pooled endpoint is in use | With the pooling step |
| Scheduled work | One daily invocation that scans every organisation | Batched invocations (cursor in the query string, several schedules), or a queue if other jobs appear | Above about 250 organisations, or when the run's reported duration passes half the function timeout |
| PDF rendering | Inside the request | Unchanged on hosted (per-invocation isolation already). For very large reports, a background render with an e-mailed link | A report that exceeds the function timeout |

For the self-hosted bundle the plan is shorter: the firm's box is the limit,
and the only horizontal step (a second app container behind the proxy) needs
the shared rate-limit store first, because two processes would otherwise each
enforce the full ceiling. Everything else in the bundle scales by giving the
container more CPU and the database more disk.

## What to measure before believing more than this

- Request rate and p95 latency per route on the hosted service, from the
  platform's analytics, over a normal week.
- Connection count on the hosted database at peak, and which endpoint
  `DATABASE_URL` uses.
- Duration of the nightly retention run as organisations grow (it is logged
  with a summary on each run).
- Memory of the bundle's app container at idle and under five concurrent PDF
  exports.
