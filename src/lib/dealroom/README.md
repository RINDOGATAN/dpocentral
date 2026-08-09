# Dealroom intake — producing a DPA + TIA from DPO Central

DPO Central knows each customer's stack (sub-processors, hosting regions,
data categories, evidenced controls). Dealroom knows how to draft
contracts. This package carries **facts** across that boundary and gets
back the finished document set — nothing about drafting crosses in either
direction.

## Flow

1. Map your program data into a `DealroomFactPackage` (see
   `intake-types.ts` — the `DpaParameters` interface documents every DPA
   field, and `DPA_CLAUSE_OPTIONS` the choice points worth an opinion:
   breach window, sub-processor regime, government-access commitments,
   deletion regime, audit regime).
2. `createDealroomDeal(pkg, { idempotencyKey })` — one POST, returns an
   agreed deal plus download paths.
3. `downloadDealroomDocument(response.documents.pdf)` — the signed-ready
   DPA. `response.documents.tia` is the standalone Transfer Impact
   Assessment (producible on demand for a supervisory authority).
   Pass `{ whiteLabel: true }` for finals without platform branding.

```ts
const res = await createDealroomDeal(
  {
    schema: "dealroom.solo-intake/1",
    contractType: "DPA",
    governingLaw: "SPAIN",
    language: "en",
    dealName: `${vendor.name} DPA`,
    fillRole: "PROCESSOR",
    selectionPolicy: "defaults",
    selections: {
      "breach-notification": "72h",
      "subprocessor-approval": "general-30d",
      "government-access-requests": "commitments",
    },
    parameters: {
      "processing-purpose": engagement.purpose,
      "data-categories": mapCategories(engagement),        // your mapping
      "data-excluded": engagement.excludedDataStatement,
      "processor-establishment": vendor.establishment,      // "US" | "EEA" | …
      "subprocessor-list": formatSubprocessors(vendor),     // your register
      "toms-confirmed": mapEvidencedControls(vendor.audit), // your evidence
      "toms-inherited": mapInheritedControls(vendor),
      "tia-gov-requests-received": vendor.govRequestHistory,
      "tia-breach-history": vendor.breachHistory,
    },
  },
  { idempotencyKey: `dpa-${engagement.id}` },
);
const pdf = await downloadDealroomDocument(res.documents!.pdf, { whiteLabel: true });
```

The mapping functions (`mapCategories`, `formatSubprocessors`,
`mapEvidencedControls`…) are DPO Central's side of the seam — they read
this app's own models, which this package deliberately knows nothing about.

## Setup

- `DEALROOM_URL` — `http://localhost:8486` on the suite (default), or the
  hosted origin.
- `DEALROOM_API_KEY` — mint a `drk_` key in Dealroom `/admin/customers`
  with scopes `negotiate` + `deals:read`. Server-side only.

## Guarantees from Dealroom's side

- Clause/option identifiers are skill-authored ids and codes — stable
  across reseeds. Introspect the full catalog and parameter schema via
  `GET /api/v1/agent/templates/DPA`.
- Invalid selections (unknown clause/option, unavailable in the chosen
  jurisdiction) fail the intake with a 422 listing them — nothing drifts
  silently.
- `Idempotency-Key` makes retries safe (24 h window).
- Facts flow into every derived representation consistently: the TIA
  mirrors the declared categories and measures, contractual supplementary
  measures appear only when the government-access clause is agreed, and
  the deal page shows the obligations ledger the document creates.
