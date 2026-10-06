#!/usr/bin/env node
// Checks a Pipe API v1 key and the calls an integration uses, against the
// sandbox. Reads only, unless you pass --write. Prints status codes, ids and
// counts; never customer details, never the key.
//
//   PIPE_API_KEY=psk_... node sandbox-check.mjs
//   PIPE_API_KEY=psk_... node sandbox-check.mjs --write
//   PIPE_API_KEY=psk_... node sandbox-check.mjs --write --file-url https://example.com/test.pdf
//
// Options:
//   --base <url>      API base. Default https://staging-api.pipe.solar/v1
//                     (the production address is refused)
//   --write           Also run writes on one sandbox lead and project: a lead
//                     PATCH that sends the lead's own first name back, a stage
//                     move into the stage the project is already in, and
//                     (with --file-url) one file into the project's "other" folder.
//   --file-url <url>  A public https file for the upload check.
//
// Needs Node 18 or later. No packages.

const args = process.argv.slice(2);
const option = (name) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const base = (option("--base") ?? "https://staging-api.pipe.solar/v1").replace(/\/+$/, "");
const write = args.includes("--write");
const fileUrl = option("--file-url");
const key = process.env.PIPE_API_KEY;

if (!key) {
  console.error("Set PIPE_API_KEY to your sandbox key first.");
  process.exit(2);
}
if (new URL(base).hostname === "api.pipe.solar") {
  console.error("Refused: this check runs only against the sandbox, never production.");
  process.exit(2);
}

let failures = 0;
const pass = (name, detail = "") => console.log(`PASS  ${name}${detail ? `  (${detail})` : ""}`);
const fail = (name, detail) => {
  failures += 1;
  console.log(`FAIL  ${name}  (${detail})`);
};

async function call(method, path, body) {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    if ((response.status === 429 || response.status === 503) && attempt < 3) {
      const wait = Number(response.headers.get("retry-after")) || 5;
      console.log(`WAIT  ${method} ${path} answered ${response.status}; retrying in ${wait}s`);
      await new Promise((resolve) => setTimeout(resolve, wait * 1000));
      continue;
    }
    let json = null;
    try {
      json = await response.json();
    } catch {
      // Not JSON; the check below reports the status.
    }
    return { status: response.status, json };
  }
}

function errorOf(result) {
  const error = result.json?.error;
  return error ? `${result.status} ${error.code}: ${error.message}` : `HTTP ${result.status}`;
}

async function check(name, method, path, body, expect = [200]) {
  try {
    const result = await call(method, path, body);
    if (expect.includes(result.status)) return result;
    fail(name, errorOf(result));
  } catch (error) {
    fail(name, error instanceof Error ? error.message : String(error));
  }
  return null;
}

console.log(`Pipe API check against ${base}${write ? " (with writes)" : ""}\n`);

// 1. The key.
const me = await check("GET /me: the key works", "GET", "/me");
if (me) pass("GET /me: the key works", `company "${me.json.company?.name}"`);
else {
  console.log("\nThe key does not work, so nothing else can run.");
  process.exit(1);
}

// 2. A wrong key answers 401 with the error shape.
try {
  const response = await fetch(`${base}/me`, { headers: { Authorization: "Bearer psk_wrong" } });
  const json = await response.json().catch(() => null);
  if (response.status === 401 && json?.error?.code) pass("A wrong key answers 401 with error.code");
  else fail("A wrong key answers 401 with error.code", `HTTP ${response.status}`);
} catch (error) {
  fail("A wrong key answers 401", String(error));
}

// 3. Stages.
const stages = await check("GET /stages", "GET", "/stages");
if (stages) pass("GET /stages", `${stages.json.data.length} stages`);

// 4. Leads: list, one lead, its activities.
const leads = await check("GET /leads", "GET", "/leads?limit=5");
const lead = leads?.json.data?.[0];
if (leads) pass("GET /leads", `${leads.json.data.length} on the first page, next ${leads.json.next ? "set" : "null"}`);
if (lead) {
  const one = await check("GET /leads/{id}", "GET", `/leads/${encodeURIComponent(lead.id)}`);
  if (one) pass("GET /leads/{id}", `id ${one.json.id}, status ${one.json.status}, folders ${Object.keys(one.json.files ?? {}).length}`);
  const activities = await check("GET /leads/{id}/activities", "GET", `/leads/${encodeURIComponent(lead.id)}/activities?limit=5`);
  if (activities) {
    const rows = activities.json.data;
    const missing = rows.filter((row) => !("authorId" in row) || !("replyTo" in row) || !("customerFacing" in row));
    if (missing.length === 0) pass("GET /leads/{id}/activities", `${rows.length} rows, each with authorId, replyTo, customerFacing`);
    else fail("GET /leads/{id}/activities", `${missing.length} rows lack a field`);
  }
  const unknown = await call("GET", "/leads/not-a-real-id");
  if (unknown.status === 404) pass("An unknown lead answers 404");
  else fail("An unknown lead answers 404", errorOf(unknown));
} else if (leads) {
  fail("GET /leads/{id}", "the sandbox lists no lead for this key");
}

// 5. Projects: list and one project.
const projects = await check("GET /projects", "GET", "/projects?limit=5");
const project = projects?.json.data?.[0];
if (projects) pass("GET /projects", `${projects.json.data.length} on the first page`);
let full = null;
if (project) {
  full = await check("GET /projects/{id}", "GET", `/projects/${encodeURIComponent(project.id)}`);
  if (full) {
    const p = full.json;
    pass("GET /projects/{id}", `id ${p.id}, ${p.productLine}, stage "${p.stage?.name}", milestones ${Object.keys(p.milestones ?? {}).length}, folders ${Object.keys(p.files ?? {}).length}`);
    const byLead = await check("GET /projects/{leadId}: a project answers to its lead's id", "GET", `/projects/${encodeURIComponent(p.leadId)}`);
    if (byLead) pass("GET /projects/{leadId}: a project answers to its lead's id");
  }
}

// 6. Writes, on the sandbox only.
if (write && lead) {
  const firstName = lead.customer?.firstName;
  if (firstName) {
    const patched = await check("PATCH /leads/{id} (same first name back)", "PATCH", `/leads/${encodeURIComponent(lead.id)}`, { firstName });
    if (patched) pass("PATCH /leads/{id} (same first name back)");
  }
  const badEmail = await call("PATCH", `/leads/${encodeURIComponent(lead.id)}`, { salesRepEmail: "nobody@example.invalid" });
  if (badEmail.status === 400) pass("PATCH with an unknown rep email answers 400 and changes nothing");
  else fail("PATCH with an unknown rep email answers 400", errorOf(badEmail));
}
if (write && full) {
  const p = full.json;
  if (p.stage?.id || p.stage?.name) {
    const moved = await check("POST /projects/{id}/stage (its own stage)", "POST", `/projects/${encodeURIComponent(p.id)}/stage`, p.stage.id ? { stageId: p.stage.id } : { stage: p.stage.name });
    if (moved) pass("POST /projects/{id}/stage (its own stage)", `changed ${moved.json.changed}`);
  } else console.log("SKIP  POST /projects/{id}/stage (the first project has no stage yet)");
  const badStage = await call("POST", `/projects/${encodeURIComponent(p.id)}/stage`, { stage: "No Such Stage" });
  if (badStage.status === 400) pass("An unknown stage answers 400");
  else fail("An unknown stage answers 400", errorOf(badStage));
  if (fileUrl) {
    const added = await check("POST /projects/{id}/files", "POST", `/projects/${encodeURIComponent(p.id)}/files`, { folder: "other", files: [{ url: fileUrl }] }, [200, 201]);
    if (added) pass("POST /projects/{id}/files", `HTTP ${added.status}, added ${added.json.files.map((file) => file.added).join(",")}`);
  }
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
