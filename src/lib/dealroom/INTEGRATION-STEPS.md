# Producing a DPA + TIA from DPO Central — step-by-step

The client package (`intake-types.ts`, `intake-client.ts`, this folder) is
already merged and tested. What remains is DPO Central's half of the seam:
mapping *this app's* vendor knowledge into fact packages and giving users a
button. Each step below is small, independently verifiable, and sized for
one short working session. Steps marked 🤖 have a ready-to-paste prompt for
a Claude session in this repo.

---

## Part A — Connect (once, ~10 minutes, no code)

### Step 1 — Mint an API key in Dealroom
1. Open your Dealroom admin: `http://localhost:8486/admin` (suite) and go
   to **Customers**.
2. Create a customer named `DPO Central` (any email, e.g.
   `dpo-central@yourdomain`).
3. Create an API key for it with scopes **`negotiate`** and **`deals:read`**.
4. Copy the `drk_…` key — it is shown once.

✅ Check: the key appears in the customer's key list with both scopes.

### Step 2 — Configure DPO Central
Add to DPO Central's server environment (`.env.local` for dev):

```
DEALROOM_URL=http://localhost:8486
DEALROOM_API_KEY=drk_...
```

(For dev against a Dealroom dev server instead of the suite container, use
its port, e.g. `http://localhost:3000`.)

✅ Check: `grep DEALROOM .env.local` shows both lines.

### Step 3 — Smoke test the connection
Save as `tmp-smoke.ts` in the repo root and run
`npx tsx tmp-smoke.ts`, then delete it:

```ts
import { createDealroomDeal, downloadDealroomDocument } from "./src/lib/dealroom/intake-client";
import { writeFileSync } from "fs";

async function main() {
  const res = await createDealroomDeal(
    {
      schema: "dealroom.solo-intake/1",
      contractType: "DPA",
      governingLaw: "SPAIN",
      language: "en",
      dealName: "Smoke test DPA (delete me)",
      fillRole: "CONTROLLER",
      selectionPolicy: "defaults",
      selections: { "government-access-requests": "commitments" },
      parameters: {
        "processing-purpose": "Smoke test.",
        "data-categories": "contact-details",
        "processor-establishment": "US",
      },
    },
    { idempotencyKey: `smoke-${Date.now()}` },
  );
  console.log("deal:", res.agentDealRoomId, res.status);
  const tia = await downloadDealroomDocument(res.documents!.tia);
  writeFileSync("smoke-tia.pdf", Buffer.from(tia));
  console.log("wrote smoke-tia.pdf");
}
main();
```

✅ Check: `smoke-tia.pdf` opens as a Transfer Impact Assessment. Delete the
script, the PDF, and the smoke deal (visible in Dealroom's deal list).

---

## Part B — Build (one small session per step)

### Step 4 — The mapper 🤖
Create `src/lib/dealroom/mapper.ts`: `vendorToDpaFactPackage(vendor, org, opts)`.

Concrete mappings from this app's models:

| DPO Central | Fact package |
|---|---|
| `org` name | `initiatorCompany` (the org is the **CONTROLLER**; `fillRole: "CONTROLLER"` — the vendor countersigns later) |
| `vendor.name` + DPA purpose text | `dealName` (e.g. `"<vendor> DPA"`), `parameters["processing-purpose"]` |
| `vendor.dataProcessed` (DataCategory[]) | `parameters["data-categories"]` via: IDENTIFIERS→`contact-details,identification-data`; FINANCIAL→`financial-data`; LOCATION→`location-data`; BEHAVIORAL→`usage-technical`; EMPLOYMENT→`professional-data`; HEALTH/BIOMETRIC/GENETIC/POLITICAL/RELIGIOUS/SEXUAL_ORIENTATION/CRIMINAL→`special-category`; DEMOGRAPHICS/EDUCATION/OTHER→`data-categories-other` free text |
| `vendor.countries` | `parameters["processor-establishment"]`: contains "US"→`US`; all EEA→`EEA`; "GB"→`UK`; else `OTHER`. **Establishment means where the vendor is established, not every region it stores data — prefer an explicit per-vendor field/metadata over inference when they differ.** |
| `vendor.certifications` (SOC 2 / ISO 27001) | gate `parameters["toms-confirmed"]` — only claim controls the certification evidence actually covers; when in doubt map certifications to `org-audits-review` in `tia-safeguards` and leave TOMs at baseline |
| sub-processor knowledge (VendorCatalog / questionnaire answers) | `parameters["subprocessor-list"]` (semicolon-separated with role + region) |
| questionnaire answers, if present | `tia-gov-requests-received`, `tia-breach-history` (default `"unknown"` — never fabricate declarations) |

Fixed sensible defaults: `selections` `{ "breach-notification": "72h",
"subprocessor-approval": "general-30d", "government-access-requests":
"commitments" }`, `selectionPolicy: "defaults"`, `governingLaw`/`language`
from an option or org setting.

> Paste-ready prompt: *"Read src/lib/dealroom/INTEGRATION-STEPS.md Step 4
> and src/lib/dealroom/intake-types.ts, then implement
> vendorToDpaFactPackage in src/lib/dealroom/mapper.ts with unit tests in
> tests/dealroom-mapper.test.ts covering the DataCategory mapping table,
> establishment inference (US / EEA / UK / OTHER / explicit override), and
> the rule that unevidenced controls stay off toms-confirmed."*

✅ Check: mapper tests pass.

### Step 5 — Produce endpoint 🤖
`POST /api/vendors/[id]/produce-dpa` (org-scoped auth like the other vendor
routes): build the package with the mapper — allowing the request body to
override any parameter (that's the review step's edits) — call
`createDealroomDeal` with `idempotencyKey: "dpa-" + vendorContractId`, then
create a `VendorContract` row: `type: DPA`, `status: PENDING_SIGNATURE`,
`name: "<vendor> DPA"`, and store
`metadata: { dealroom: { agentDealRoomId, documents } }`. No migration
needed.

✅ Check: calling it (curl or test) creates the contract row and the deal
appears in Dealroom.

### Step 6 — Download proxy 🤖
`GET /api/vendors/[id]/dpa-document?kind=pdf|docx|txt|tia&whitelabel=1` —
reads the `metadata.dealroom.documents` path from the vendor's DPA
contract, streams it via `downloadDealroomDocument` (the `drk_` key never
reaches the browser).

✅ Check: hitting it in the browser (while signed in) downloads the PDF.

### Step 7 — UI 🤖
On the vendor detail page: a **"Produce DPA + TIA"** action that
1) shows the mapped fact package pre-filled for review (the human confirms
   facts — especially establishment, data categories, TOMs — before
   anything is generated),
2) on confirm calls the produce endpoint,
3) then shows download links (PDF / white-label PDF / TIA) and the
   `PENDING_SIGNATURE` contract in the vendor's contracts list.

✅ Check: full click-through on a test vendor against local Dealroom.

### Step 8 — Test suite green
`npx tsc --noEmit`, `npm test`, `npm run lint`.

---

## Part C — Ship

### Step 9 — Tag the release
The next DPO Central tag also carries the **session-cookie isolation fix**
already sitting on `main` (commit `1f0ffa2`) — both ship together.
Dealroom must be ≥ **v0.1.27** on the suite (it is, via `:latest`).

### Step 10 — Live suite configuration
On the production suite host: mint the `drk_` key on the live Dealroom
(`:8486/admin`), add `DEALROOM_URL=http://localhost:8486` and
`DEALROOM_API_KEY` to DPO Central's compose environment, restart.

✅ Check: produce a real DPA for one vendor end-to-end; keep the white-label
PDF as the signature-ready final.

### Later (optional) — the outbound half
Once producing works: ingest Dealroom's obligations ledger (TIA review
every 12 months, transparency-report cadence, breach window) into DPO
Central's review calendar (`nextReviewAt` / notifications). Design note
lives in the Dealroom project's memory; ask for it when you start.
