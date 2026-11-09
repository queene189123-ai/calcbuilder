# Supabase project files

- `config.toml` identifies the linked project and records Edge Function JWT settings.
- `functions/` contains the currently deployed server-side function sources.
- `migrations/` contains the new November 9, 2026 changes.

**Important:** the original production schema migrations dated November 4–5, 2026 were applied before this folder was added and their SQL source has not yet been reconstructed here. The remote database is already running those migrations. Do not run `supabase db reset` against this partial migration history. Before using a fresh local database or provisioning a second environment, first pull/reconstruct the original schema baseline and verify it against the live project.

## Security notes

- The Gmail connection, OAuth state, incoming-message, and monitor tables have explicit deny-all policies for `anon` and `authenticated`; server-side Edge Functions access them with the service role only after membership checks.
- `create_company_for_current_user` and `create_manual_quote` are intentionally callable by authenticated users as `SECURITY DEFINER` functions: both use an empty `search_path`; the first requires `auth.uid()` and creates a company only for that user, while the second requires `auth.uid()` plus an `owner`/`admin`/`buyer` membership check before writing. Supabase's linter flags the `SECURITY DEFINER` execution surface; these RPCs are required by the current onboarding and manual-quote UI and must not be exposed to `anon`.
- Supabase Auth's leaked-password protection is currently disabled in project settings and should be enabled in the Supabase Dashboard before public customer onboarding.
- Migration `20261109064438_harden_public_api_grants.sql` removes `anon` access from existing `public` tables/sequences, removes direct `authenticated` access to the internal Gmail tables, and revokes default `anon`/`authenticated` privileges for new objects created by `postgres`. Existing authenticated access to company-scoped business tables remains governed by RLS.
- Supabase's linter reports `pg_net` in the public extension namespace; the installed extension is non-relocatable in this project. Its HTTP functions remain in the dedicated `net` schema and are used only by the scheduled monitor.

- `gmail_monitor_seen_messages` stores only opaque Gmail message IDs and check timestamps for messages that were inspected by metadata. It prevents repeated checks without retaining unrelated email content.
