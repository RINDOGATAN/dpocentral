# Assembling a DPA + TIA from this pack — the complete playbook

This pack is Dealroom's DPA know-how, published as data so DPO Central can
generate the documents **by itself** from each privacy program's facts. No
API, no account: everything needed is in this folder.

- `dpa/` — the skill source: `clauses.json` (every negotiable clause with
  all option variants, EN/ES), `boilerplate.json` (preamble, definitions,
  standard clauses, general provisions, per-jurisdiction provisions,
  signature block, annexes I–IV with conditional sections),
  `parameters.json` (the fact catalog), `metadata.json`.
- `derived-texts.json` — every generator-authored passage, enumerated per
  variant and language, plus the token-translation map.
- `manifest.json` — schema, source commit, per-file hashes.

**Canonical source & refresh:** the Dealroom repo owns this content. To
refresh after Dealroom changes:
`cd ~/NEL/deal-room-todo && npm run pack:dpo -- <this folder>` — only the
JSON files are rewritten; this file is hand-maintained.

---

## 1. The fact model

A document is produced from one flat map of **facts**: parameter values
keyed by the ids in `dpa/parameters.json`, plus one **selection** (an
option) per clause in `dpa/clauses.json`.

- Parameter values are strings; multi-selects are comma-joined keys.
- If a fact is absent and its parameter declares a `default`, **use the
  default** (e.g. `include-tia` defaults `"yes"`, `toms-physical` defaults
  `"provider-managed"`, `include-uk-addendum`/`include-swiss-adaptations`
  default `"yes"`).
- Parameters marked `required: true` must be present
  (`processing-purpose`, `data-categories`, `processor-establishment`).
- Language is `"en"` or `"es"`; always read the matching key of the
  bilingual objects.

## 2. Document assembly order

1. **Cover** (optional): title = `boilerplate.contractTitle`, parties, date,
   governing law (see §5 for the governing-law display value).
2. `preamble` (interpolate `{curly}` variables — §4).
3. `background`.
4. **Definitions** — `boilerplate.definitions` in file order.
5. **Standard clauses** — `boilerplate.standardClauses` in file order.
6. **Negotiated terms** — for each clause in `dpa/clauses.json` ordered by
   `order`: render the selected option's `legalText` (after `[token]`
   interpolation — §3). Rules:
   - An option whose `legalText` is empty means "clause omitted" — skip it
     (e.g. `government-access-requests` → `none`).
   - The `governing-law-jurisdiction` clause renders as its **own article**
     (typically after the other terms), not inside the numbered list.
7. **General provisions** — `boilerplate.generalProvisions` in order.
8. **Jurisdiction provision** —
   `boilerplate.jurisdictionProvisions[governingLaw]` (one of
   `CALIFORNIA`, `ENGLAND_WALES`, `SPAIN`).
9. **Signature block** — `boilerplate.signatureBlock`.
10. **Annexes** — after the signatures, each on its own page, in file
    order, subject to the visibility rules in §6.

## 3. `[token]` interpolation (clause texts)

Parameters with a `token` fill `[token]` occurrences in clause `legalText`:

- Only apply a parameter whose `scope` is `"*"` or equals the clause's id.
- Matching is case-insensitive.
- In Spanish text, also match the Spanish spelling from
  `derived-texts.json → tokenTranslations` (e.g. `[ley aplicable]` for
  `governing law`); the English token also matches in Spanish text.
- A missing value leaves the bracket visible — that is intentional (a
  fill-in blank). Warn the user before finalizing when any declared
  parameter's token remains unfilled.

## 4. `{curly}` interpolation (boilerplate)

Variables come from three sources:

a. **Parameters with `boilerplateVariable`** — value (or default) under
   that name, e.g. `processingPurpose`, `dataExcluded`, `tomsConfirmed`,
   `includeTia`, `processorEstablishment`.
b. **Context**: `effectiveDate` (long-form date), `partyAName`,
   `partyBName`, `partyAAddress`, `partyBAddress`, `partyAId`, `partyBId`
   (tax ids), `partyASignatureBlock`, `partyBSignatureBlock`,
   `governingLaw` (§5). Party naming rule: **never render an email as a
   party or signatory name** — fall back to the placeholder
   `[_________________]`. For the DPA, Party A is the **Controller** and
   Party B the **Processor**; if the producing side is the Processor, swap
   the name/address/id/signature variables accordingly.
c. **Derived variables** — computed from facts per §5, with their exact
   texts in `derived-texts.json`.

## 5. Derived variables (the generator's brain, as rules)

All texts are in `derived-texts.json`; the rules pick which entry:

| Variable | Rule |
|---|---|
| `{governingLaw}` | Display name of the deal's governing law ("Kingdom of Spain" / "State of California…"). **Override:** if the `governing-law-jurisdiction` selection is the custom option (`glj-custom`) and `custom-governing-law` is set, use that free text EVERYWHERE the governing law renders — cover included. |
| `{dataCategoriesList}` | Lettered list `(a) Label;` per selected `data-categories` key, labels from that parameter's `optionLabels`; append free-text entries from `data-categories-other` (split on `;`). Empty → `derived.dataCategoriesFallback`. |
| `{processingPurpose}` | The parameter verbatim; **append `derived.euResidencyNote` when `tia-safeguards` contains `tech-eu-residency`** (a residency claim must surface in Annex I). |
| `{processorEstablishmentDisplay}` | `derived.establishmentDisplay[processor-establishment]`. |
| `{dpfStatement}` | `derived.dpfStatement.certified` iff `processor-dpf-certified == "yes"`, else `.notCertified`. |
| `{tiaSafeguardsList}` | Lettered list of the selected `tia-safeguards` (labels from `optionLabels`; only `tech-*`/`org-*` exist). **Append `derived.govAccessDerivedMeasure` iff the `government-access-requests` clause is agreed with the `commitments` option** — that is the only way a contractual measure may appear. Empty → `derived.safeguardsEmpty`. |
| `{tiaConclusion}` | `derived.tiaConclusion.withTechnicalMeasure` iff at least one selected safeguard starts `tech-`, else `.residualRisk` (EDPB rule — never soften this). |
| `{tiaEcspStatement}` | `importerStatements.ecsp[tia-importer-hosted]` (default `yes`). |
| `{tiaRequestHistoryStatement}` | `importerStatements.requestHistory[tia-gov-requests-received]` (default `unknown`). |
| `{tiaBreachHistoryStatement}` | `importerStatements.breachHistory[tia-breach-history]` (default `unknown`). |
| `{transferAddendaSections}` | `transferAddendaSections["uk-<include-uk-addendum>_swiss-<include-swiss-adaptations>"]` (defaults yes/yes). |
| `{tomsInherited}` | `toms-inherited` **intersected with** `toms-confirmed` (never attribute an unconfirmed control), comma-joined. |
| `{tomsInheritedList}` | Lettered list of that intersection, labels from **`toms-confirmed`'s** `optionLabels`. |

## 6. Conditional annexes and sections

An annex — or an entry in its `sections` array — may declare `showIf`: a
condition or array of conditions, **ANDed**, each one of:

- `{ variable, in: [...] }` — the variable's value is in the list;
- `{ variable, contains: "x" }` — the comma-joined value includes `x`;
- `{ variable, present: true }` — the value is non-empty after trim.

Missing variables **fail closed** (annex/section hidden). A visible annex
renders its `text` followed by each visible section, joined by blank
lines. Concretely for the DPA:

- **Annex I** always renders; its "expressly excluded" section only when
  `dataExcluded` is present.
- **Annex II** always renders: modest baseline + only the sections whose
  key is in `tomsConfirmed` + the physical-security variant matching
  `tomsPhysical` + the inherited-controls section when `tomsInherited`
  (post-intersection) is non-empty.
- **Annex III** renders iff `processorEstablishment ∈ {US, OTHER}`.
- **Annex IV** renders iff Annex III does AND `includeTia != "no"`.

## 7. Consistency rules (do not skip)

These answers are representations; enforce them at fact-collection time:

1. `tech-pseudonymization` claimed while transferring directly identifying
   categories (`contact-details`, `identification-data`, `financial-data`,
   `account-credentials`) → require explicit human confirmation.
2. `tech-eu-residency` with a US/OTHER processor → require confirmation
   (and note it auto-surfaces in Annex I via §5).
3. `toms-confirmed` only from **actual audit evidence** (SOC 2 / ISO
   27001); certifications alone justify `org-audits-review` in the TIA,
   not TOMs warranties. Unevidenced areas stay at the baseline.
4. `processor-establishment` = where the processor is **established**, not
   every region it stores data.
5. Declarations (`tia-gov-requests-received`, `tia-breach-history`) must
   come from the processor — default `unknown`, never fabricate `none`.

## 8. The standalone TIA

Producible on demand (SCC Clause 14): render **Annex IV alone**, preceded
by an identification header — data exporter (Controller), data importer
(Processor), "Annex IV to the Data Processing Agreement ‹deal name›, dated
‹date›", production date, and one sentence stating it reproduces Annex IV
without modification for disclosure to the competent supervisory authority
on request under Clause 14 of the incorporated SCCs.

## 9. Mapping from DPO Central's models (suggested)

| DPO Central | Fact |
|---|---|
| `Vendor.dataProcessed` | `data-categories` (IDENTIFIERS→contact-details,identification-data; FINANCIAL→financial-data; LOCATION→location-data; BEHAVIORAL→usage-technical; EMPLOYMENT→professional-data; HEALTH/BIOMETRIC/GENETIC/POLITICAL/RELIGIOUS/SEXUAL_ORIENTATION/CRIMINAL→special-category; rest→`data-categories-other`) |
| Vendor establishment (explicit field preferred over `countries` inference) | `processor-establishment` |
| `Vendor.certifications` | `tia-safeguards: org-audits-review`; TOMs only with evidence (§7.3) |
| Sub-processor register / questionnaires | `subprocessor-list`; `tia-gov-requests-received`; `tia-breach-history` |
| Processing activity purpose | `processing-purpose`; excluded-data statement → `data-excluded` |
| Org policy | clause selections (`breach-notification` window, `subprocessor-approval` regime, `government-access-requests`) |

Store the produced PDFs on the vendor's `VendorContract` (type `DPA`).

## 10. Recurring obligations (optional but recommended)

After producing, derive the compliance-calendar entries from the same
facts: TIA re-evaluation every 12 months (when Annex IV renders), annual
aggregate transparency report (when `government-access-requests` =
`commitments`), the confirmed TOMs cadences (quarterly access reviews,
monthly scans, annual pen test/restore tests per the selected sections),
the breach-notification window, and the sub-processor notice period.
