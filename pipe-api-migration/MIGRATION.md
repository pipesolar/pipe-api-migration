# Pipe API: old calls to v1, field by field

This is the full map from the old Pipe API (`https://pipe.solar/api/1.1/wf/<name>`)
to Pipe API v1 (`https://api.pipe.solar/v1`). It covers the six old calls
Firefly Solar's systems made in the last 45 days, plus `update-lead-assignment`:
every parameter, and every field of every answer. It was read from the old API's own definitions and from the v1
specification on 2026-10-06.

`openapi.json` next to this file is the v1 specification. The live copy is at
`https://staging-api.pipe.solar/v1/openapi.json`, and the guide is at
`https://developers.pipe.solar`.

## 1. Dates (all times Eastern; Edmonton is two hours earlier)

| When | What happens |
| --- | --- |
| Now to Oct 10 | Build and test against the sandbox, `https://staging-api.pipe.solar/v1`, with your sandbox key. The old API keeps working. |
| Oct 11, about 3:30 AM ET (1:30 AM MT) | The old API stops. A call to `https://pipe.solar/api/1.1/...` answers HTTP 410 with `{"error": "moved", "docs": "https://pipe.solar/api/v1"}`. |
| Oct 11, about 3:30 AM to 10 AM ET | Neither API answers. Hold or queue writes in this window. |
| Oct 11, 10 AM ET (8 AM MT) | v1 opens on production, `https://api.pipe.solar/v1`, with your live key. Before this it answers 403 `not_open`. |

Put the base URL and the key in configuration, so the switch at 10 AM ET is a
setting change, not a deploy.

**Warning: send every old call to `pipe.solar`.** Only `https://pipe.solar/api/1.1/...`
answers 410. If any code, script or automation calls the old API on another
host name, that call can keep answering "success" after Oct 11 while what it
writes is lost. Search for `api/1.1/` on every host, and move or stop each such
call before Oct 11.

## 2. What changes for every call

| | Old API | v1 |
| --- | --- | --- |
| Base URL | `https://pipe.solar/api/1.1/wf/` | `https://api.pipe.solar/v1` (sandbox: `https://staging-api.pipe.solar/v1`) |
| Key | `Authorization: Bearer <old token>`; `fetch_lead`, `Update_Lead` and `update-lead-assignment` took none | `Authorization: Bearer psk_...` on every call (one key per company; never in a web page, a repository or a log) |
| Parameters | Query string, form fields or a JSON body, varying by call | The record id in the path; a JSON body for writes (`Content-Type: application/json`) |
| Errors | HTTP 200 with `"success": false` or `"success": "no"` in the body | A real HTTP status: 400 `invalid`, 401 `unauthorized`, 403 `forbidden` or `not_open`, 404 `not_found`, 429 `rate_limited`, 500 `internal`, 503 `unavailable`. Body: `{"error": {"code", "message", "docs"}}` |
| Values | Every value is text: `"9.6"`, `""` | Real JSON: numbers are numbers, an empty value is `null`, money is dollars and cents (`24350.5`) |
| Dates | Text `m/dd/yy` (`10/6/26`) | A day is `YYYY-MM-DD`; a time is ISO 8601 in UTC (`2026-10-06T14:03:22.123Z`) |
| Limit | None stated | 100 calls a minute per key. A 429 carries `Retry-After` in seconds; wait that long and retry |
| Lists | Everything at once | Pages: `?limit=1..100&cursor=<next>`; each answer is `{"data": [...], "next": "<cursor or null>"}` |
| Unknown fields | Ignored | A body field v1 does not know is refused with 400 (for example a leftover `home_improvement`). Send only the fields this map names |
| Numbers as text | Money had thousands commas (`"24,350.50"`), some with `$` | Plain numbers (`24350.5`). Code that rebuilds the old text must add the commas back |

### Record ids

- **The ids your system stores for leads and projects still work.** In v1
  each `{id}` in a path takes Pipe's new id, or the 10-character UID your
  system holds from the old API (the customer's or the project's), or the old
  record id. A project also answers to its lead's id, as the old UID named both.
- **Two kinds of old id do not resolve, and answer 404:** the UID of a Home
  Improvement lead, and the id of an activity row. Read a Home Improvement
  lead's new id from `GET /v1/leads?productLine=hi`. Activity rows: see 3.4.
- **Records made after Oct 11 have only a new id.** It is a longer string.
  Store ids as plain text of any length, and remove any check that an id has
  10 characters.
- Every v1 answer carries `id` (the new id) and `reference` (the old UID, when
  there is one). On a newer lead `reference` can be `null`, or can repeat `id`.
  Store `id` from now on, and match on it.
- The sandbox holds made-up records with new ids only. Your stored UIDs are
  not in the sandbox; read sandbox ids from `GET /v1/leads` and `GET /v1/projects`.

## 3. Call by call

| Old call | v1 call |
| --- | --- |
| `GET fetch_lead?id=<UID>` (Retrieve Lead by ID) | `GET /v1/leads/{id}` |
| `GET fetch_project/<UID>` (Retrieve Project Data) | `GET /v1/projects/{id}` |
| `update_stage/<stage name>/<UID>` (Change Project Stage) | `POST /v1/projects/{id}/stage` with `{"stage": "<name>"}` or `{"stageId": "<id>"}` |
| `GET fetch_all_activity?project_id=<UID>&installer_id=<id>` (Retrieve Lead Activities) | `GET /v1/leads/{id}/activities` |
| `POST project_upload_file/<UID>` with `project_id`, `folder_id`, `fileurl` | `POST /v1/projects/{id}/files` with `{"folder", "files": [{"url", "name"}]}` |
| `Update_Lead` with `id`, `home_improvement`, `primary_*`, `secondary_*` | `PATCH /v1/leads/{id}` |
| `update-lead-assignment` with `id`, `sales_rep_email`, `setter_email` | `PATCH /v1/leads/{id}` with `salesRepEmail`, `setterEmail` |

New in v1, if useful: `GET /v1/me` (check a key), `GET /v1/leads` and
`GET /v1/projects` (lists, with `updatedSince=<ISO time>` for changes only),
`GET /v1/stages` (your stage names and ids), `PATCH /v1/projects/{id}`
(`installDate`, `ntpGranted`), `POST /v1/leads` (create), `GET /v1/adders`,
`GET /v1/equipment`.

### 3.1 Read a lead: `fetch_lead` to `GET /v1/leads/{id}`

The old answer was `{"id": "<UID>", "data": {...}}`. The v1 answer is the lead
object itself. "proposal" below is the lead's leading option: the one the
customer chose, else the newest.

| Old field (`data.` unless noted) | v1 field | Note |
| --- | --- | --- |
| `id` (top level) | `reference` | `id` is the new id |
| `customerFirstName`, `customerLastName` | `customer.firstName`, `customer.lastName` | |
| `customerPhoneNumber`, `customerEmail` | `customer.phone`, `customer.email` | |
| `customerAddress` | `address.line1` (plus `line2`, `city`, `state`, `postalCode`, `country`) | The old value was one line; v1 splits it |
| `customerCity`, `customerState`, `customerZip` | `address.city`, `address.state`, `address.postalCode` | |
| `secondaryCustomerFirstName`, `...LastName`, `...PhoneNumber`, `...Email` | `coBorrower.firstName`, `.lastName`, `.phone`, `.email` | `coBorrower` is `null` when there is none |
| `leadSource`, `subLeadsource` | `source.name`, `source.subSource` | |
| `leadStatus` | `status` | `Lead` `lead`, `Discovery` `discovery`, `Proposal` `proposal`, `Site Survey` `siteSurvey`, `Docs Signed` `docsSigned`, `Approved` `approved`, `Denied` `denied`, `Pending` `pending`, `Completed` `completed`, `Cancelled` `cancelled`, `Project` `project` |
| `contractSignedDate` | `createdAt` (the same value) or `project.soldAt` (the real signing time) | The old value was the lead's creation day, not the signing day |
| `submittedDate` | none | The old value was always today's date. Use `project.soldAt` or `updatedAt` |
| `projectSiteId` | `utility.meterNumber` | |
| `designName`, `scaniflyProjectId`, `designId` | `design.name`, `design.scaniflyProjectId`, `design.scaniflyDesignId` | |
| `contractURL` | `contractFiles` | A list of links |
| `allFilesURL.surveyFiles` | `files.siteSurvey` | |
| `allFilesURL.personalFiles` | `files.identification` | |
| `allFilesURL.utilityBills` | `files.utilityBill` | |
| `allFilesURL.insuranceFiles` | `files.identification` (the same list) | The old list held the identification files a second time. `files.homeInsurance` is the real insurance folder |
| `proposalURL` | `links.proposal` | New address shape: `https://pipe.solar/p/<token>` |
| `systemSize` | `proposal.system.sizeKw` | Number |
| `estProduction` | `proposal.system.annualProductionKwh` | |
| `numberOfPanel`, `panelManufacturer`, `panelModel` | `proposal.system.panels.count`, `.manufacturer`, `.model` | |
| `numberOfInverter`, `inverterManufacturer`, `inverterModel` | `proposal.system.inverters.count`, `.manufacturer`, `.model` | |
| `numberOfBattery`, `batteryManufacturer`, `batteryModel` | `proposal.system.batteries.count`, `.manufacturer`, `.model` | `batteries` is `null` with no battery |
| `batteryCapacity` | `proposal.system.batteries.capacityKwh` × `count` | The old value was the total; v1 gives one battery's capacity |
| `numberOfArrays` | `proposal.system.arrays` | Can be `0` or `null` on a design made before Oct 11 that held the old count only |
| `solarCost` | `proposal.price.beforeTax` − `proposal.price.adders` | The old value was the price before tax, minus the adders |
| `salesTax` | `proposal.price.salesTax` | |
| `financeCompany` | `proposal.financing.lender` | `null` for cash |
| `financeAmount` | `proposal.price.beforeTax` | The old value was the price before tax |
| `financeAPR` | `proposal.financing.aprPercent` | Number, `5.99` |
| `financeTerm` | `proposal.financing.termMonths` | Old was years; v1 is months |
| `financeType` | `proposal.financing.type` | `cash`, `loan`, `lease` or `ppa` |
| `basePpw`, `finalPpw` | `proposal.system.pricePerWatt.base`, `.final` | |
| `adders[] {name, cost}` | `proposal.adders[] {name, quantity, total}` | |
| `salesRepName`, `salesRepEmail`, `salesRepPhone` | `salesRep.name`, `.email`, `.phone` | `salesRep` is `null` when none |
| `setterName`, `setterEmail`, `setterPhone` | `setter.name`, `.email`, `.phone` | |
| (none) | `partnerLeadId` | The partner's lead id (Home Depot's, for example) |

### 3.2 Read a project: `fetch_project` to `GET /v1/projects/{id}`

A solar project carries `system`; a Home Improvement project carries
`products` instead. `productLine` says which.

| Old field (`data.` unless noted) | v1 field | Note |
| --- | --- | --- |
| `id` (top level) | `reference` | `id` is the new project id; `leadId` is its lead |
| `customerFirstName`, `customerLastName`, `customerPhoneNumber`, `customerEmail` | `customer.firstName`, `.lastName`, `.phone`, `.email` | |
| `customerAddress`, `customerStreet` | `address.line1` | |
| `customerCity`, `customerState`, `customerZip` | `address.city`, `address.state`, `address.postalCode` | |
| `secondaryCustomer*` (4 fields) | `coBorrower.firstName`, `.lastName`, `.phone`, `.email` | |
| `notes` | `notes.project` | The project's own notes. `notes.customer` holds the lead's notes |
| `utilityProvider` | `utility.name` | |
| `leadSource`, `subLeadsource` | `source.name`, `source.subSource` | |
| `home_depot_id` | `partnerLeadId` | |
| `projectStatus` | `stage.name` | `stage.id` and `stage.enteredAt` too |
| `contractSignedDate` | `contract.signedAt` | ISO time |
| `submittedDate` | none | The old value was always today's date |
| `projectSiteId` | `meterNumber` | |
| `designName` | `design.name` | |
| `scaniflyProjectId` | `design.scaniflyProjectId` | |
| `designId` | `design.scaniflyDesignId` | |
| `soldDesignId` | `design.soldScaniflyDesignId` | |
| `contractURL` | `contract.files` | |
| `allFilesURL.surveyFiles` | `files.siteSurvey` | A folder with no file is left out of `files`: read a missing key as `[]` |
| `allFilesURL.personalFiles`, `allFilesURL.driverLicense` | `files.identification` | The old answer sent the same list twice |
| `allFilesURL.utilityBills` | `files.utilityBill` | |
| `allFilesURL.insuranceFiles` | `files.homeInsurance` | |
| `allFilesURL.installationPhotos` | `files.installationPhoto` | |
| `allFilesURL.plansets` | `files.planset` | |
| `allFilesURL.materials` | `files.material` | |
| `allFilesURL.otherDocuments` | `files.other` | |
| `allFilesURL.interconnection` | `files.interconnection` | |
| `allFilesURL.permits` | `files.permit` | |
| `allFilesURL.internalDocuments` | `files.internal` | |
| `proposalURL` | `links.proposal` | `https://pipe.solar/p/<token>` |
| `projectURL` | `links.project` | `https://pipe.solar/dashboard/projects/<id>` |
| `systemSize` | `system.sizeKw` | |
| `estProduction` | `system.annualProductionKwh` | |
| `numberOfPanel` | `system.panels.count` | |
| `panelModel` | `system.panels.model` | The old field held the manufacturer; v1 also has `system.panels.manufacturer` |
| `numberOfInverter` | `system.inverters.count` | |
| `inverterName` | `system.inverters.name` | Plus `.manufacturer`, `.model`, `.microinverter`. The text can differ from the old full name |
| `numberOfBattery` | `system.batteries.count` | The old value was only `1` or `0`; v1 gives the real count, and `batteries` is `null` with no battery |
| `batteryName` | `system.batteries.model` | Plus `.manufacturer`, `.capacityKwh`. Can be `null` on a project sold before Oct 11 that named its battery only in text |
| `numberOfArrays` | none on the project | Always empty in the old answer. The lead has `proposal.system.arrays` |
| `roofPitch` | none | Always an empty list in the old answer |
| `roofType` | `system.roofType` | |
| `solarCost` | `system.pricePerWatt.final` × `system.sizeKw` × 1000 | The exact old formula. It is not the same figure as `contract.priceBeforeTax` |
| `contractPrice` | `contract.price` | The signed price with tax |
| `salesTax` | `contract.salesTax` | |
| `financeCompany` | `financing.lender` | The old value was `Cash` for a cash deal; v1 gives `null` |
| `financeAmount` | `contract.priceBeforeTax`, or empty when `financing.type` is `cash` | The old value was the price before tax. v1's `financing.amount` is the price with tax |
| `financeAPR` | `financing.aprPercent` | |
| `escalator` | `financing.escalatorPercent` | Lease and PPA only |
| `financePayment` | `financing.monthlyPayment` | |
| `financeTerm` | `financing.termMonths` | Old was years |
| `financeType` | `financing.type` | `cash`, `loan`, `lease`, `ppa`. The old value never said PPA: it printed `Lease` for every lease and PPA |
| `basePpw`, `finalPpw` | `system.pricePerWatt.base`, `.final` | |
| `adders` | `system.adders[] {name, quantity, total}` | The old key for the amount was `price` |
| `addersCost` | sum of `system.adders[].total` | |
| `salesRepName`, `salesRepEmail`, `salesRepPhone` | `salesRep.name`, `.email`, `.phone` | |
| `setterName`, `setterEmail`, `setterPhone` | `setter.name`, `.email`, `.phone` | |
| `subContractorName` | `subcontractor.name` | |
| `siteSurveyorName` | `siteSurveyor.name` | |
| `installCompletedDate` | `milestones.installScheduled` | The old field held the install's scheduled day. The real completion day is `milestones.installCompleted` |
| `inspectionCompletedDate` | `milestones.inspectionCompleted` | |
| `ptoApprovedDate` | `milestones.ptoApproved` | |
| `siteSurveyUploadedDate` | `milestones.siteSurveyScheduled` | The old field held the survey's scheduled day. `milestones.siteSurveyUploaded` is the upload day |
| (none) | `projectManager`, `ntpGranted`, `company`, `customFields`, `updatedAt` | New |

`milestones` holds only the milestones that have a day, each as `YYYY-MM-DD`.
A missing key means no day.

### 3.3 Move a stage: `update_stage` to `POST /v1/projects/{id}/stage`

- Old: `id` (the customer UID) and `project_stage_name` in the address.
- v1: the id in the path; the stage in a JSON body: `{"stage": "Install Scheduled"}`
  by name (case does not matter), or `{"stageId": "<id>"}`. Send one, not both.
  `stageId` comes from `GET /v1/stages` and survives a rename, so prefer it.
- Stage names are unchanged from the old app. v1 matches only the stages of
  the project's own company; read them from `GET /v1/stages`.
- Old answer: `{"success": true, "message": ..., "data": {"project_id", "new_status"}}`.
  v1 answer: `{"changed": true, "stage": "<name>", "stageId": "<id>"}`.
  A move into the stage the project is already in answers `"changed": false`.
- An unknown stage is HTTP 400; an unknown project is 404. The old API answered
  both with 200 and `"success": false`.

### 3.4 Read activities: `fetch_all_activity` to `GET /v1/leads/{id}/activities`

- Old: `project_id` (the customer UID) and `installer_id`. v1 needs only the id;
  the key already names your company. Drop `installer_id`.
- Old answer: `{"projectId", "total", "activities": [...]}`, newest first, all at
  once. v1: `{"data": [...], "next"}`, newest first, 50 a page (up to 100 with
  `limit`). Follow `next` until it is `null`. There is no `total`; count the rows.
- **Order.** Pages run in the order Pipe recorded the rows, and the rows
  written before Oct 11 were recorded together. To get the old order, read
  every page, then sort by `createdAt`, newest first.
- **The old answer left out replies and customer-facing notes.** v1 returns
  every row. To get the old set, keep rows where `replyTo` is `null` and
  `customerFacing` is `false`. **Caution:** a reply written before Oct 11
  reads `replyTo: null`, so it stays in that set as an ordinary row. Only
  replies written from Oct 11 carry `replyTo`.

| Old field | v1 field | Note |
| --- | --- | --- |
| `id` | `reference` | **Every v1 `id` is new, also for old rows.** `reference` holds the old id of a row written before Oct 11, and is `null` for newer rows. A sync that de-duplicates on the old id must match it against `reference`, or it imports the history a second time |
| `createdAt` | `createdAt` | When the row was written, old rows included. Old: `2026-10-06T14:03:22Z`; v1 adds milliseconds: `2026-10-06T14:03:22.123Z` |
| `parentOwnerId` | `authorId` | The same id the activity webhook sends; `null` for rows the app wrote |
| `parentOwnerName` | `author` | |
| `notes` | `body` | |
| `type` | `type` | See below |
| (none) | `internal`, `customerFacing`, `replyTo` | |

`type` is now one of a short list: `note`, `status`, `stage`, `assignment`,
`share`, `appointment`, `task`, `file`, `price`, `system`, `checklist`. The
old value was a long label such as "Notes", "Status Change" or "Plansets
Added". The full sentence is in `body`. **Rows written before Oct 11 carry only
`note` (any row with note text), `system` or `checklist`,** so code that needs
the old label for them reads `body`. For rows written from Oct 11, code that
branches on the old labels maps them, for example: "Notes" to `note`; "Status Change" to `stage` or
`status`; any "... Added" or "... Uploaded" file label to `file`; "Proposal
Price Change" to `price`; "New Task Assigned" to `task`; "Appointment Set" to
`appointment`; "New Member Added" or "Project Assigned" to `assignment`.

### 3.5 Upload files: `project_upload_file` to `POST /v1/projects/{id}/files`

- Old: the UID in the address (`project_upload_file/<UID>`) and a body
  `{"project_id": "<UID>", "folder_id": "<folder>", "fileurl": ["<url>", ...]}`.
- v1: the id in the path; body `{"folder": "<folder>", "files": [{"url": "<url>", "name": "<optional name>"}]}`.
  1 to 10 files a call. Each address must be public `https`, open without a
  sign-in, and hold a file of 100 MB or less. Pipe keeps its own copy.
  The same address sent to the same folder again adds nothing.
- Answer: `{"files": [{"id", "name", "folder", "added"}]}`, HTTP 201 when a
  file was added, 200 when all were already there.

| Old `folder_id` | v1 `folder` |
| --- | --- |
| `contract` | `contract` |
| `utility_bill` | `utilityBill` |
| `drivers_license` | `identification` |
| `materials` | `material` |
| `survey_photos` | `siteSurvey` |
| `engineering_plansets` | `planset` |
| `permits` | `permit` |
| `interconnection`, `interconnections` | `interconnection` |
| `insurance` | `homeInsurance` |
| `installation_photos` | `installationPhoto` |
| `internal_documents` | `internal` |
| `other_documents` | `other` |

### 3.6 Change a lead: `Update_Lead` to `PATCH /v1/leads/{id}`

| Old parameter | v1 field |
| --- | --- |
| `id` | the path `{id}` |
| `home_improvement` | none: one id names solar and Home Improvement leads alike |
| `primary_first_name`, `primary_last_name` | `firstName`, `lastName` |
| `primary_email`, `primary_phone` | `email`, `phone` |
| `secondary_first_name`, `secondary_last_name`, `secondary_email`, `secondary_phone` | `coBorrower: {firstName, lastName, email, phone}` |

- **Warning: an empty value means something else now.** The old call kept a
  field when you sent it empty. v1 keeps a field only when you leave it out.
  An empty text or `null` clears an optional field (`email`, `phone`, `notes`,
  each `coBorrower` field). An empty first or last name is refused with 400. Send only the fields that changed. This is on purpose: a lead
  read from v1 can be sent back as it is.
- v1 also takes `notes` and `address` (`line1`, `city`, `state`, `postalCode`
  together; `line2` and `country` optional). The state or province must be one
  Pipe supports, or the call is refused with 400.
- Do not send `home_improvement`: v1 refuses a field it does not know.
- The answer is the lead as it now reads, the same shape as `GET /v1/leads/{id}`.
  An unknown id is 404 (the old call answered 200 with `"success": "no"`).

### 3.7 Change the rep or setter: `update-lead-assignment` to `PATCH /v1/leads/{id}`

| Old parameter | v1 field |
| --- | --- |
| `id` | the path `{id}` |
| `sales_rep_email` | `salesRepEmail` |
| `setter_email` | `setterEmail` |

- The person must be an active member of the lead's company, found by the
  email they sign in with.
- **Warning: an unknown email now refuses the whole call.** The old call
  changed what it could and answered `"partial_success"`. v1 answers 400
  `invalid`, names the email, and changes nothing.
- **Warning: an empty text or `null` takes the rep or setter off the lead.**
  The old call left them unchanged. Leave the field out to keep the person.
- One call can change the rep, the setter and the customer details together.

## 4. Webhooks Pipe sends you

Your receiver needs no change in what it parses. Pipe sends the same events,
to the same address and paths, with the same keys in the same order, and
values in the same text form: project created and project submitted (to the
address itself, with no path), project updated (`/update`), status change
(`/lead_update`), activity created (`/activity_update`) and customer updated
(`/lead_update`).

Check these five things in the code that reads them:

1. **Links have new addresses.** File links become `https://pipe.solar/files/<secret>`
   or `https://pipe.solar/f/<key>`; `proposalURL` becomes `https://pipe.solar/p/<token>`;
   `projectURL` becomes `https://pipe.solar/dashboard/projects/<id>`. Old saved
   links still open. Remove any code that parses ids out of the old link
   shapes (`/proposal/<id>`, `mydashboard?m=<id>`) or checks a file link's host.
2. **Ids of new records are longer.** A lead or person made after Oct 11 has a
   new-style id. Store ids as text of any length.
3. **`notes` in the activity event is now filled** with the activity's own line;
   the old event often sent it empty.
4. **The body is always valid JSON.** A quote in a name no longer breaks it.
5. **Some values can differ on some records.** On projects designed or sold
   before Oct 11: `numberOfArrays` can be empty, and the design ids,
   `financeLoanId` and the wording of `financeCompany` can differ from what
   the old app sent. In the activity event, `parentOwnerId` on a row the app
   wrote itself, and in project updated the status words of
   `post_sale_revision`, can differ. Code that matches these values exactly
   should accept the new form, or log and skip it.

## 5. What has no successor

| Old | Why |
| --- | --- |
| `submittedDate` | The old value was always the day of the call |
| `roofPitch` | Always an empty list |
| Home Improvement lead UID | Not kept: read the new id from `GET /v1/leads?productLine=hi` |
| Old activity labels on rows written before Oct 11 | Only `note`, `system` or `checklist`; the sentence is in `body` |
| Old reply flag on rows written before Oct 11 | Not kept: such replies read `replyTo: null` |
| `numberOfArrays` on the project | Always empty; use the lead's `proposal.system.arrays` |
| `installer_id` parameter | The key names your company |
| `home_improvement` parameter | One id space for solar and Home Improvement |
| `customerPhoneType`, `communication_opted_out` | Never in the old API |
