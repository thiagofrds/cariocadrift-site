#!/bin/sh
# Roda todas as migrations e os testes num Postgres local isolado (Homebrew postgresql@17). Não toca em nenhum projeto Supabase.
# Uso: sh supabase/tests/rodar-local.sh
set -e; export LC_ALL=en_US.UTF-8
PG=/opt/homebrew/opt/postgresql@17/bin; D="${TMPDIR:-/tmp}/cd-pg-teste"; S=/tmp/cdpg; mkdir -p "$S"
[ -d "$D/data" ] || "$PG/initdb" -D "$D/data" -U harness --auth=trust -E UTF8 >/dev/null
"$PG/pg_ctl" -D "$D/data" status >/dev/null 2>&1 || "$PG/pg_ctl" -D "$D/data" -o "-p 54329 -k $S -c listen_addresses=''" -l "$D/log" start >/dev/null
psql() { "$PG/psql" -h "$S" -p 54329 -U harness -v ON_ERROR_STOP=1 -q "$@"; }
psql -d postgres -c "drop database if exists cd_teste;" -c "create database cd_teste;"
psql -d cd_teste -f supabase/tests/shim-supabase-local.sql
psql -d cd_teste -c "grant all on schema public, storage to dono; alter table storage.objects owner to dono; alter table storage.buckets owner to dono;"
for m in supabase/migrations/*.sql; do "$PG/psql" -h "$S" -p 54329 -U dono -v ON_ERROR_STOP=1 -q -d cd_teste -f "$m"; done
"$PG/psql" -h "$S" -p 54329 -U harness -d cd_teste -f supabase/tests/interessados_carona.sql | grep -v '^_como\|^_reset\|^(1 row)\|^ *$\|^ok$\|^INSERT\|^CREATE\|^UPDATE\|^Output format'
"$PG/pg_ctl" -D "$D/data" stop >/dev/null
