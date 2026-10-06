# Instructions for AI coding agents

This repository is a kit for moving a codebase from the old Pipe API
(`https://pipe.solar/api/1.1/wf/...`) to Pipe API v1
(`https://api.pipe.solar/v1`).

When a user asks you to migrate, update or check a Pipe integration, read
`pipe-api-migration/SKILL.md` and follow it step by step. It uses
`pipe-api-migration/MIGRATION.md` (every old call and field mapped to v1),
`pipe-api-migration/openapi.json` (the v1 specification) and
`pipe-api-migration/sandbox-check.mjs` (a sandbox test).

Rules that always hold:

1. Never call production (`https://api.pipe.solar`). Test only against the
   sandbox, `https://staging-api.pipe.solar/v1`.
2. Never write a key into code, tests, commits, logs or replies. Read it from
   `PIPE_API_KEY` or the codebase's secret store.
3. Never print customer data.
4. Write `PIPE_MIGRATION_REPORT.md` before you change code, and stop for the
   user's review unless they said not to.
5. Keep the old path behind a switch until the cutover; work on a new branch;
   never merge or deploy.
6. Do not guess a mapping that `MIGRATION.md` does not give.
