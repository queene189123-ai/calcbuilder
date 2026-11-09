# Восстановление чистого окружения СнабПро

Этот путь предназначен только для **нового отдельного Supabase-проекта**. Не запускать baseline на рабочей БД.

## Что лежит в этой папке

- `20261109_live_schema_baseline.sql` — реконструированная финальная схема: таблицы, ограничения, индексы, функции, триггер, RLS, storage policies и grants.
- `20261109_configure_gmail_monitor.sql` — отдельная настройка pg_cron/pg_net, генерация нового monitor token и расписание проверки Gmail раз в 10 минут. В SQL требуется заменить `__SUPABASE_PROJECT_URL__` на URL нового проекта.

Baseline не является восстановлением оригинальных миграций от 4–5 ноября. Он собран по текущей живой схеме.

## Порядок развёртывания нового проекта

1. Создать новый Supabase-проект. Не использовать проект с данными СнабПро.
2. Убедиться, что в нём доступны стандартные схемы Supabase `auth` и `storage`, а также Vault. Для Gmail-мониторинга должны быть доступны расширения pg_cron и pg_net.
3. Применить baseline к новой базе через psql (или SQL Editor):
   ```bash
   psql "$NEW_SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/reconstructed/20261109_live_schema_baseline.sql
   ```
4. Сделать копию `20261109_configure_gmail_monitor.sql`, заменить в ней `__SUPABASE_PROJECT_URL__` на URL нового Supabase-проекта и применить:
   ```bash
   psql "$NEW_SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f ./20261109_configure_gmail_monitor.sql
   ```
   Скрипт генерирует новый токен и сохраняет его в Vault; токен не хранится в GitHub.
5. Связать локальный проект с новым Supabase-проектом и отметить миграции, уже включённые в baseline, как применённые:
   ```bash
   supabase link --project-ref <NEW_PROJECT_REF>
   supabase migration repair 20261104201645 20261104201755 20261104201831 20261104202015 20261104202151 20261104212902 20261104215741 20261105105833 20261105105842 20261109060413 20261109060546 20261109060814 20261109061053 20261109061247 20261109061733 20261109062806 20261109063132 20261109064438 20261109065057 20261109065241 20261109083319 --status applied
   supabase migration list
   ```
   Это нужно, потому что baseline содержит конечное состояние этих изменений. Не запускать эти миграции повторно поверх baseline.
6. Развернуть Edge Functions и настроить их секреты/redirect URLs для нового проекта отдельно. Проверить OAuth consent screen и Google OAuth credentials — они не переносятся из SQL.
7. Выполнить read-only проверку схемы: `psql \"$NEW_SUPABASE_DB_URL\" -v ON_ERROR_STOP=1 -f supabase/reconstructed/verify_baseline.sql`. Скрипт сверяет количество объектов, RLS, RPC-права и настройки bucket; он не изменяет данные.\n8. Проверить cron job, Edge Functions, OAuth secrets и Storage policies в новом проекте. Сверить с `supabase/RECOVERY.md`.

## Важные ограничения

- Этот сценарий пока **не считается проверенным**: его нужно выполнить на отдельном временном Supabase-проекте и сравнить результат с инвентаризацией. Не использовать production для такой проверки.
- Девять оригинальных миграций 4–5 ноября отсутствуют в GitHub. Их содержимое не реконструируется под видом оригинала.
- Текущие 12 миграционных файлов 9 ноября приведены к версиям из live migration ledger.
- Storage objects и пользовательские файлы не копируются baseline-скриптом.
- Данные, пользователи Auth, OAuth refresh tokens, секреты Vault, Edge Function secrets и cron execution history не переносятся.
- В существующей БД ничего не сбрасывать и не переприменять.
