#!/bin/sh
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v runtime_user="$POSTGRES_RUNTIME_USER" \
  -v runtime_password="$POSTGRES_RUNTIME_PASSWORD" \
  -v migrator_user="$POSTGRES_MIGRATOR_USER" \
  -v migrator_password="$POSTGRES_MIGRATOR_PASSWORD" \
  -v db_name="$POSTGRES_DB" <<'EOSQL'
DO $role_setup$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'runtime_user') THEN
    EXECUTE format('CREATE ROLE %I LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE PASSWORD %L', :'runtime_user', :'runtime_password');
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'migrator_user') THEN
    EXECUTE format('CREATE ROLE %I LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE PASSWORD %L', :'migrator_user', :'migrator_password');
  END IF;
END
$role_setup$;
GRANT CONNECT ON DATABASE :"db_name" TO :"runtime_user";
GRANT CONNECT ON DATABASE :"db_name" TO :"migrator_user";
GRANT USAGE, CREATE ON SCHEMA public TO :"migrator_user";
EOSQL
