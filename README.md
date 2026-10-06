# Pipe API migration kit

A kit that moves your integration from the old Pipe API
(`https://pipe.solar/api/1.1/wf/...`) to Pipe API v1 (`https://api.pipe.solar/v1`).
It works with any AI coding tool: Codex, Cursor, Grok Build, GitHub Copilot,
Gemini CLI, Windsurf and others. An engineer can also follow it
by hand.

## The dates (Eastern Time; Edmonton is two hours earlier)

- **Now to October 10:** build and test against the sandbox,
  `https://staging-api.pipe.solar/v1`, with your sandbox key.
- **October 11, about 3:30 AM ET:** the old API stops: `https://pipe.solar/api/1.1/...`
  answers HTTP 410. Move any call that uses another host name before then.
- **October 11, 10 AM ET:** v1 opens on production with your live key.

## What the kit does in your codebase

1. **Finds** every call to the old API, every place that reads an old answer,
   and every handler for the webhooks Pipe sends you.
2. **Reports first.** It writes `PIPE_MIGRATION_REPORT.md`: each call site by
   file and line, its v1 replacement, the behaviour traps it hits, and
   anything it cannot map. It stops there until you say go.
3. **Changes the code** behind one switch (`old` or `v1`), with one v1 client
   (key, retries on 429, real HTTP errors) and one adapter that turns v1
   answers into the shape your code already reads.
4. **Proves it on the sandbox**, never on production, and says what it did
   not prove.

It never writes a key into code, never calls production and never deploys.

## What is in it

| File | What it is |
| --- | --- |
| `PROMPT.md` | The one prompt to paste into any AI tool; it links to this repository |
| `AGENTS.md` | The same instructions, read automatically by most tools when you open this kit's own repository |
| `pipe-api-migration/SKILL.md` | The step-by-step procedure (any tool can read it) |
| `pipe-api-migration/MIGRATION.md` | The full map: every old call, parameter and field, and its v1 equivalent |
| `pipe-api-migration/openapi.json` | The v1 specification (live copy: `https://staging-api.pipe.solar/v1/openapi.json`) |
| `pipe-api-migration/sandbox-check.mjs` | A test of your key and each call against the sandbox (Node 18+, no packages) |

## How to use it

1. Open your AI coding tool in your own repository.
2. Paste the prompt in `PROMPT.md`. It gives the tool this repository's link;
   the tool fetches the kit itself and follows it.
3. Read the report it writes, `PIPE_MIGRATION_REPORT.md`, and tell it to go on.

If your tool supports skills, you can also copy the folder
`pipe-api-migration/` into its skills folder in your repository, then ask
"Use the pipe-api-migration skill." An engineer without an AI tool reads
`pipe-api-migration/MIGRATION.md`.

Test your sandbox key in one line, from this kit's folder (Node 18 or later):

```
PIPE_API_KEY=<your sandbox key> node pipe-api-migration/sandbox-check.mjs
```

## Keys

Pipe sends each key separately, never in this repository. Keep keys in your
secret store and pass them through an environment variable. The sandbox key
reaches only your practice company on the sandbox; the live key works on
production from 10 AM ET on October 11.

## Help

The v1 guide is at `https://developers.pipe.solar`. For anything this kit
cannot map, ask your Pipe contact.
