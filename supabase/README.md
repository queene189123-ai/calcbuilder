# Supabase project files

- `config.toml` identifies the linked project and records Edge Function JWT settings.
- `functions/` contains the currently deployed server-side function sources.
- `migrations/` contains the new November 9, 2026 changes.

**Important:** the original production schema migrations dated November 4–5, 2026 were applied before this folder was added and their SQL source has not yet been reconstructed here. The remote database is already running those migrations. Do not run `supabase db reset` against this partial migration history. Before using a fresh local database or provisioning a second environment, first pull/reconstruct the original schema baseline and verify it against the live project.
