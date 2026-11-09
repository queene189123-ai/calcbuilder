# Supabase project files

- `config.toml` identifies the linked project and records Edge Function JWT settings.
- `functions/` contains the currently deployed server-side function sources.
- `migrations/` contains the new November 9, 2026 changes.

**Important:** the original production schema migrations dated November 4–5, 2026 were applied before this folder was added and their SQL source has not yet been reconstructed here. The remote database is already running those migrations. Do not run `supabase db reset` against this partial migration history. Before using a fresh local database or provisioning a second environment, first pull/reconstruct the original schema baseline and verify it against the live project.

## Security notes

- The Gmail connection, OAuth state, incoming-message, and monitor tables intentionally have RLS enabled with no client-facing policies. They are accessed only by server-side Edge Functions using the service role, after membership checks.
- `create_manual_quote` is a `SECURITY DEFINER` transaction function. It checks `auth.uid()` and permits only `owner`, `admin`, or `buyer` members before writing any records.
- Supabase Auth's leaked-password protection is currently disabled in project settings and should be enabled in the Supabase Dashboard before public customer onboarding.
- Supabase's linter reports `pg_net` in the public extension namespace; the installed extension is non-relocatable in this project. Its HTTP functions remain in the dedicated `net` schema and are used only by the scheduled monitor.
