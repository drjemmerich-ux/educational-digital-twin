# Pilot deployment

| Part | Where | Status |
| --- | --- | --- |
| Source | GitHub `drjemmerich-ux/educational-digital-twin` (private), branch `main` | Live |
| Database | Supabase project `educational-digital-twin` (`aczupeihejdguwipqcfz`, Frankfurt eu-central-1, free plan) | Project created; schema **not yet applied** |
| Server engine | Supabase Edge Function `edt-engine`, deployed by `.github/workflows/deploy-edge.yml` | **Not yet deployed** (needs `SUPABASE_ACCESS_TOKEN` secret) |
| Participant and facilitator pages | Vercel project linked to the GitHub repository (`vercel.json`) | **Not yet created** |

## One-time setup (Dr Emmerich)

1. **Database.** Supabase → SQL Editor → New query → paste `deploy/setup-database.sql` → Run.
   The last line returns your facilitator key once. Store it in a password manager. Only its hash is stored.
2. **Server engine.** Supabase → Account → Access Tokens → Generate new token.
   GitHub → repository → Settings → Secrets and variables → Actions → New repository secret:
   name `SUPABASE_ACCESS_TOKEN`, value the token. Then GitHub → Actions → "Deploy server engine" → Run workflow.
3. **Web pages.** Vercel → Add New → Project → Import `educational-digital-twin` → Deploy (settings come from `vercel.json`).
   Participant page: `https://<project>.vercel.app/` (opens only with a personal link).
   Facilitator page: `https://<project>.vercel.app/facilitator`.

## Running the pilot

- Facilitator page → enter the key → "Create link" with a neutral label (Fellow 01). The link is shown once.
  Send it privately. Keep any name mapping outside this system.
- A lost link: disable it and create a new one.
- Data withdrawal (consent): SQL Editor → `select public.edt_withdraw_participant('P-XXXXXX');`
  This deletes that participant's encounters and disables the link.
- A new facilitator key: `select public.edt_create_facilitator_key('label');`
  Revoke one: `update public.edt_facilitator_keys set revoked = true where label = 'label';`

## Security model

- The participant page contains no hidden case content. The build fails if any of the 212 hidden case strings
  (24+ characters) appears in a participant or facilitator bundle.
- Personal links carry a 256-bit random token in the URL fragment (not sent to web servers or in referrers).
  Only the SHA-256 hash is stored.
- All tables have row-level security with no policies, and the public API roles have no grants; the database
  functions also check the calling role. Only the Edge Function (service role) reads and writes.
- `edt_events` is append-only (trigger); deletion is possible only through `edt_withdraw_participant`.
- Known limit: tutor events are composed in the participant's browser and validated by type on the server.
  A participant could alter tutor text in their own record only. Clinical events are always produced by the server.
