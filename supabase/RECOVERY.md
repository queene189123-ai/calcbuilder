# Supabase schema recovery notes

## Current production database inventory

Inspected directly from Supabase project `tdewylpxanviyhdwdnci` on 2026-11-09. This is an inventory of the live schema, not a replacement for the original migration SQL.

- 17 tables in `public`
- 4 helper/privileged functions in `private`
- 2 public RPC wrappers
- 19 RLS policies
- 75 table constraints
- 62 indexes
- Storage bucket: `quote-documents`

### Public tables

`companies`, `company_members`, `materials`, `suppliers`, `purchase_requests`, `purchase_request_items`, `quote_documents`, `supplier_quotes`, `quote_items`, `company_gmail_connections`, `gmail_oauth_states`, `supplier_email_messages`, `purchase_request_suppliers`, `material_folders`, `gmail_monitor_config`, `gmail_monitor_runs`, `gmail_monitor_seen_messages`.

### Private functions

- `private.is_company_member(uuid, uuid)`
- `private.add_company_creator_as_owner()`
- `private.create_company_for_current_user(text)`
- `private.create_manual_quote(...)`

### Migration history currently recorded by Supabase

| Version | Name |
|---|---|
| 20261104201645 | initial_procurement_schema |
| 20261104201755 | secure_company_isolation_and_quote_storage |
| 20261104201831 | index_foreign_keys_for_procurement |
| 20261104202015 | fix_optional_composite_foreign_keys |
| 20261104202151 | add_workspace_fields_for_frontend_sync |
| 20261104212902 | add_company_gmail_connections |
| 20261104215741 | secure_company_creation_rpc |
| 20261105105833 | create_company_material_folders |
| 20261105105842 | add_material_folder_assignment |
| 20261109060413 | schedule_gmail_inbox_monitor |
| 20261109060546 | persist_supplier_email_drafts |
| 20261109060814 | add_atomic_manual_quote_entry |
| 20261109061053 | track_supplier_reply_timestamps |
| 20261109061247 | index_procurement_foreign_keys |
| 20261109061733 | track_gmail_monitor_runs |
| 20261109062806 | allow_csv_quote_documents |
| 20261109063132 | track_seen_gmail_message_ids |
| 20261109064438 | harden_public_api_grants |
| 20261109065057 | add_explicit_deny_policies_for_internal_gmail_tables |
| 20261109065241 | move_privileged_rpcs_to_private_schema |

## Recovery finding

The GitHub commit history for `supabase/migrations` contains only the 11 migration files added on 2026-11-09. The nine migrations dated 2026-11-04 and 2026-11-05 are recorded in the live Supabase migration ledger but their SQL files were never committed to this repository. They cannot be restored byte-for-byte from the repository's current path history.

Do not fabricate those files and label them as original migrations. A clean-environment deployment requires a reviewed, reconstructed baseline from the live schema, including column definitions, defaults, constraints, indexes, RLS policies, grants, functions, triggers, storage bucket configuration and storage policies. The live database remains authoritative until that baseline is independently applied and verified in a disposable project.

## Safe next steps

1. Preserve the live database; do not reset or replay migrations against it.
2. Export a complete schema-only snapshot from Supabase CLI/SQL tooling, including storage policies and grants.
3. Review the snapshot against the inventory above and the deployed Edge Functions.
4. Create a clearly named reconstructed baseline for new environments, then verify it in a disposable Supabase project.
5. Only after a clean deployment passes, document the supported bootstrap procedure. Keep the existing live migration ledger intact.
