# The prompt

Open your AI coding tool (Codex, Cursor, Grok Build, Copilot, Gemini CLI,
Windsurf or another) in your own repository, and paste this:

---

Move this codebase from the old Pipe API to Pipe API v1. Follow the kit at
https://github.com/pipesolar/pipe-api-migration.

Get the kit first: run `git clone https://github.com/pipesolar/pipe-api-migration /tmp/pipe-api-migration`,
or, if you cannot run commands, read the files from GitHub. Then read
`pipe-api-migration/SKILL.md` in the kit and follow it step by step. It uses
`MIGRATION.md`, `openapi.json` and `sandbox-check.mjs` from the same folder.

The rules that matter most:

1. Find every old call, every reader of an old answer, and every handler of
   Pipe's webhooks. Write `PIPE_MIGRATION_REPORT.md` in this repository first,
   and stop for my review before you change code.
2. Put the v1 path behind one switch (`old` or `v1`) and keep the old path,
   so we flip it at 10 AM ET on October 11 without a deploy.
3. Never call production. Test only against the sandbox,
   `https://staging-api.pipe.solar/v1`, with the key in `PIPE_API_KEY`.
4. Never write a key into code, tests, commits, logs or your replies. Never
   print customer data.
5. Do not guess a mapping the kit does not give. List it as an unknown.
6. Work on a new branch. Do not merge or deploy.
7. In the final report, say what you proved and what you did not.

---

If your tool cannot reach GitHub, clone the kit yourself next to your code
and change the link in the prompt to that folder.
