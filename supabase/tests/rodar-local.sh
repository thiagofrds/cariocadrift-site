#!/bin/sh
# Roda todas as migrations e um roteiro de testes num Postgres local isolado (Homebrew postgresql@17). Não toca em nenhum projeto Supabase.
# Uso: sh supabase/tests/rodar-local.sh [arquivo-de-testes]   (padrão: supabase/tests/etapa-b.sql)
set -e; export LC_ALL=en_US.UTF-8
TESTES="${1:-supabase/tests/etapa-b.sql}"
PG=/opt/homebrew/opt/postgresql@17/bin; D="${TMPDIR:-/tmp}/cd-pg-teste"; S=/tmp/cdpg; mkdir -p "$S"
[ -d "$D/data" ] || "$PG/initdb" -D "$D/data" -U harness --auth=trust -E UTF8 >/dev/null
"$PG/pg_ctl" -D "$D/data" status >/dev/null 2>&1 || "$PG/pg_ctl" -D "$D/data" -o "-p 54329 -k $S -c listen_addresses=''" -l "$D/log" start >/dev/null
psql() { "$PG/psql" -h "$S" -p 54329 -U harness -v ON_ERROR_STOP=1 -q "$@"; }
psql -d postgres -c "drop database if exists cd_teste;" -c "create database cd_teste;"
psql -d cd_teste -f supabase/tests/shim-supabase-local.sql
for m in supabase/migrations/*.sql; do "$PG/psql" -h "$S" -p 54329 -U dono -v ON_ERROR_STOP=1 -q -d cd_teste -f "$m" || { echo "FALHA ao aplicar $m"; exit 1; }; echo "aplicada: $(basename "$m")"; done
"$PG/psql" -h "$S" -p 54329 -U harness -d cd_teste -f "$TESTES" | grep -v '^_como\|^_reset\|^(1 row)\|^ *$\|^ok$\|^INSERT\|^CREATE\|^UPDATE\|^DELETE\|^GRANT\|^Output format\|^Tuples only'
[ -n "$MANTER" ] || "$PG/pg_ctl" -D "$D/data" stop >/dev/null
