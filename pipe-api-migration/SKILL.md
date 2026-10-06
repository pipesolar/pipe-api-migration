---
name: pipe-api-migration
description: Move a codebase from the old Pipe API (pipe.solar/api/1.1/wf/...) to Pipe API v1 (api.pipe.solar/v1). Finds every old call and every webhook handler, writes a report first, then changes the code behind one switch and proves it on the Pipe sandbox. Use when asked to migrate, update or check a Pipe integration.
---

# Move a codebase to Pipe API v1

You are working in the user's own codebase, which Pipe has never seen. Your
job: find every place it talks to the old Pipe API or receives Pipe's
webhooks, change it to Pipe API v1, and prove it on the sandbox. The deadline
is fixed: the old API stops at about 3:30 AM ET on October 11, 2026, and v1 opens on
production at 10 AM ET the same day.

Read `MIGRATION.md` in this folder before you change anything. It maps every
old call, parameter and field to v1. `openapi.json` is the v1 specification.
`sandbox-check.mjs` tests a key and the calls against the sandbox.

## Rules

1. **Never call production.** Test only against the sandbox,
   `https://staging-api.pipe.solar/v1`. The production address,
   `https://api.pipe.solar/v1`, goes into configuration only, never into a
   test run.
2. **Never write a key anywhere.** Read the key from an environment variable
   or the codebase's own secret store. Never put it in code, a test, a
   fixture, a commit, a log line, a report or your reply. If you find an old
   token written into the code, report its file and line, and do not repeat
   its value.
3. **Never print customer data.** When you call the sandbox, print status
   codes, ids and counts, not names, emails, phones or addresses.
4. **Keep the old path until the switch.** Do not delete the old calls. Put
   the new calls behind one setting, so the team flips it at 10 AM ET on
   October 11 without a deploy, and can flip back.
5. **Work on a new branch.** Do not merge, deploy or release. The team does
   that.
6. **Say what you did not prove.** Every "works" in your report names what
   was checked, and what was not.

## Step 1: find

Search the whole repository, including configuration, infrastructure files,
scripts, scheduled jobs, low-code exports (Make, Zapier, n8n JSON) and tests.
Search case-insensitively.

Old calls:

- `api/1.1/` (any host; this catches every old call, including `api/1.1/obj/`
  data reads). Report each host name you find. Only `pipe.solar` answers 410
  after the switch; a call to any other host keeps "working" while what it
  writes is lost, so flag it as a must-fix.
- `version-test/api` (the old test address)
- The old endpoint names: `fetch_lead`, `fetch_project`, `update_stage`,
  `fetch_all_activity`, `project_upload_file`, `Update_Lead`,
  `update-lead-assignment`. Also any other name next to `api/1.1/wf`, and
  report it.
- `pipe.solar` in general, and environment variables or settings whose names
  hold `PIPE` (a base URL or a token).

Code that reads old answers (search for the field names):

- `customerFirstName`, `allFilesURL`, `contractURL`, `proposalURL`,
  `projectURL`, `projectStatus`, `leadStatus`, `scaniflyProjectId`,
  `designId`, `soldDesignId`, `home_depot_id`, `financeTerm`, `solarCost`,
  `installCompletedDate`, `siteSurveyUploadedDate`, `parentOwnerId`,
  `new_status`, `"success"`.

Code that receives Pipe's webhooks:

- Routes or handlers for `/update`, `/activity_update`, `/lead_update`, and
  the base address they hang from: project created and project submitted
  arrive at the base address itself, with no path. Also any handler that reads
  `post_sale_revision`, `parentOwnerId`, `repcard_id`, `pipe_id`, `new_status`.
- Code that parses ids out of Pipe links (`/proposal/`, `mydashboard?m=`),
  checks the host of a file link, or checks that an id is 10 characters long.

## Step 2: report, then wait

Write `PIPE_MIGRATION_REPORT.md` at the repository root before you edit code.
It holds:

1. **Call sites**: a table with one row per place, as `file:line`; the old
   call; the v1 call from `MIGRATION.md`; and the old fields the code reads
   after it.
2. **Webhook handlers**: each one, as `file:line`, and which of the five checks
   in `MIGRATION.md` section 4 it needs.
3. **Behaviour traps found**: each place that hits one of these:
   - it checks `success` in a 200 answer instead of the HTTP status;
   - it sends an empty text to mean "no change" (`Update_Lead`,
     `update-lead-assignment`); in v1 an empty value clears the field;
   - it relies on a partial success when an email is unknown; v1 refuses the
     whole call;
   - it reads `financeTerm` as years, `batteryCapacity` as a total, or
     `installCompletedDate` and `siteSurveyUploadedDate` as completion days;
   - it reads activities and expects replies and customer-facing notes to be
     left out;
   - it stores ids in a field that holds only 10 characters, or validates
     their length;
   - it branches on old activity `type` labels;
   - it de-duplicates activities on their old `id` (every v1 activity `id` is
     new; the old id is in `reference`);
   - it reads the project's `contractPrice`, `solarCost` or `financeAmount`
     (each has its own v1 source in `MIGRATION.md` 3.2);
   - it sends a field v1 does not know, such as `home_improvement` (v1
     answers 400);
   - it calls with a Home Improvement lead's old UID (v1 answers 404);
   - it calls the old API on a host other than `pipe.solar`.
4. **Gaps**: every old field the code uses that `MIGRATION.md` section 5 says
   has no successor, and what the code should do instead.
5. **Unknowns**: any old call or field that is not in `MIGRATION.md`. Do not
   guess a mapping for it. List it for the team to ask Pipe.
6. **Secrets**: any token written into the code, by file and line only.
7. **Plan**: the files you will change, in order.

Then stop and show the report to the user. Go on to step 3 only after they
say so, unless they told you up front to continue without a stop.

## Step 3: change

1. **One client.** Add one small module (or extend the existing HTTP client)
   that every v1 call goes through:
   - base URL and key from configuration: sandbox
     `https://staging-api.pipe.solar/v1`, production `https://api.pipe.solar/v1`;
   - `Authorization: Bearer <key>`, `Accept: application/json`, and
     `Content-Type: application/json` on writes;
   - a timeout on each call;
   - on 429 or 503, wait the seconds in `Retry-After` (or 5 when absent) and
     retry, at most 3 times; retry nothing else automatically;
   - on any other status of 400 or more, raise an error that carries the
     status and `error.code` and `error.message` from the body.
2. **One switch.** A setting such as `PIPE_API_VERSION=old|v1` chooses the old
   path or the v1 path at each call site. Default it to `old` on production
   and `v1` on test environments.
3. **Translate in one place.** Prefer an adapter that turns each v1 answer
   into the shape the rest of the code already reads, using the tables in
   `MIGRATION.md`. That keeps the change small and the old downstream code
   untouched. Where the codebase is small, or the team asks, update the
   readers to the v1 shape instead. Either way:
   - convert types on purpose (v1 numbers are numbers, empty is `null`, dates
     are ISO), and match what downstream code expects;
   - follow `next` on every list until it is `null`;
   - filter activities to `replyTo === null && !customerFacing` where the
     code expected the old set, then sort by `createdAt`, newest first;
   - read a missing folder in `files` as an empty list;
   - rebuild money as text with thousands commas only where downstream code
     needs the old form.
4. **Writes.**
   - Stage moves: send `stageId` when the code can look it up once from
     `GET /v1/stages` and cache it; else send `stage` with the name.
   - File uploads: map the folder names; send at most 10 files a call.
   - Lead changes: send only fields that changed. Never send an empty text to
     mean "keep it".
   - Rep and setter: send `salesRepEmail` or `setterEmail` only when it
     changes; handle a 400 for an unknown email.
5. **Ids.** Keep using the stored old UIDs; v1 accepts them. Store the new
   `id` from each answer for records made from now on. Widen any id column
   or check that assumes 10 characters.
6. **Webhooks.** Apply the five checks in `MIGRATION.md` section 4. Do not
   change what the receiver parses unless a check requires it.
7. **Tests.** Add unit tests for the adapter and the client: a sample answer
   for each call, built from `openapi.json`, through the adapter, compared
   with the old shape; a 429 with `Retry-After`; a 400, a 404 and a 401. Use
   made-up data only.

## Step 4: prove on the sandbox

1. Run the codebase's own checks and tests.
2. With the sandbox key in `PIPE_API_KEY`, run
   `node <this folder>/sandbox-check.mjs` (Node 18 or later; this folder is
   `pipe-api-migration/`, or wherever the user copied it). It reads
   only, unless the user asks for `--write`. It refuses the production
   address. Fix what fails.
3. Run the codebase's own integration against the sandbox with the switch on
   `v1`: one read of each kind, then, only if the user agrees, one stage move
   and one upload on a sandbox project. The sandbox holds made-up records with
   new ids; take ids from `GET /v1/leads` and `GET /v1/projects`.
4. Ask the team for a test address for webhooks if the receiver has not been
   tested; Pipe can point the sandbox's webhooks at it.

## Step 5: hand over

Update `PIPE_MIGRATION_REPORT.md` with what changed (a nested list: file,
then function, then change), the test results with their summary lines, what
was proved on the sandbox, and what was not. End with the switch-day steps:

1. Before Oct 11: deploy with the switch on `old` and the live key in the
   secret store.
2. Oct 11, about 3:30 AM ET: the old API answers 410. Hold or queue writes.
3. Oct 11, 10 AM ET: set the switch to `v1`. Run one read and watch the
   error logs for 15 minutes.
4. Afterwards: remove the old path in a later change.
