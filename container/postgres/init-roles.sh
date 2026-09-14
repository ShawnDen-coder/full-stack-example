#!/bin/sh
# Postgres executes this during first-time volume initialization; keep it LF-only.
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v runtime_password="$POSTGRES_RUNTIME_PASSWORD" \
  -v migrator_password="$POSTGRES_MIGRATOR_PASSWORD" \
  -v db_name="$POSTGRES_DB" <<'EOSQL'
SELECT format(
  'CREATE ROLE %I LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE PASSWORD %L',
  'app_runtime',
  :'runtime_password'
)
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime')
\gexec

SELECT format(
  'CREATE ROLE %I LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE PASSWORD %L',
  'app_migrator',
  :'migrator_password'
)
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_migrator')
\gexec

GRANT CONNECT ON DATABASE :"db_name" TO app_runtime;
GRANT CONNECT ON DATABASE :"db_name" TO app_migrator;
GRANT CREATE ON DATABASE :"db_name" TO app_migrator;
GRANT USAGE, CREATE ON SCHEMA public TO app_migrator;
EOSQL
