# Status and support

What a person using DPO Central (the hosted pilot, or an instance of your own)
can do when something goes wrong. The same text, in English and Spanish, is
on the in-app documentation page under "When something goes wrong"
(`/docs#support`); every error page links to it.

## Reporting a problem

Use **Feedback** at the top of any page once you are signed in. Say what you
were doing and what you saw. On the hosted service, every message reaches
the team in its daily review.

## The reference on an error page

When a page or an action fails, you see a reference instead of technical
detail: `E-` followed by eight characters (for example `E-3F9A01C2`), or a
string of digits for a page that failed on the server. Quote it in your
report with what you were doing. A failure on the server is recorded in the
server log under that reference, which leads to its exact cause. The
reference contains nothing about you or your records.

For operators: search the server log for the reference. Procedure failures
are logged as `tRPC <procedure> failed [ref E-XXXXXXXX]`; a page that failed
on the server is logged by Next.js with the same digest. A failure that
happened only in the browser is logged in the browser console as
`[error ref E-XXXXXXXX]` and is not sent to the server.

## Exports are always available

If a page fails, your saved records are not affected, and every report and
data export can still be downloaded. On the hosted pilot this holds at every
record ceiling and after the editing window ends
(`tests/pilot-read-and-export-always.test.ts`).

## Is the service up?

`GET /api/health` answers `200` when the database answers within 2 seconds
and its migrations match the running build, otherwise `503` with a reason
word (`database` or `migrations`). It also reports the version and commit.
