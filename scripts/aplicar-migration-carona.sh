#!/bin/sh
# Aplica a migration da Carona Radical no banco de PRODUÇÃO, em transação única, parando no primeiro erro.
# Lê SUPABASE_DB_PASSWORD de .env.local; nunca imprime a senha.
# Uso (no seu terminal, dentro do repositório):  sh scripts/aplicar-migration-carona.sh
set -e
cd "$(dirname "$0")/.."
ARQ=supabase/migrations/20260916210000_interessados_carona.sql
PSQL=/opt/homebrew/opt/postgresql@17/bin/psql
[ -x "$PSQL" ] || { echo "psql não encontrado em $PSQL"; exit 1; }
PGPASSWORD="$(grep '^SUPABASE_DB_PASSWORD=' .env.local | cut -d= -f2- | tr -d '"'"'"'"')"; export PGPASSWORD
[ -n "$PGPASSWORD" ] || { echo "SUPABASE_DB_PASSWORD ausente em .env.local"; exit 1; }
CS="$(shasum -a 256 "$ARQ" | cut -c1-16)"
[ "$CS" = "2d72e7f5973f92e6" ] || { echo "o arquivo não é a versão aprovada (checksum $CS, esperado 2d72e7f5973f92e6). Nada foi executado."; exit 1; }
echo "arquivo conferido: $ARQ (versão aprovada, commit 332537a)"
# conexão direta (IPv6) ou, se falhar, o pooler em modo sessão (IPv4)
for CONN in "host=db.trkwfwvqzfvscqwwldpv.supabase.co port=5432 dbname=postgres user=postgres sslmode=require" \
            "host=aws-0-sa-east-1.pooler.supabase.com port=5432 dbname=postgres user=postgres.trkwfwvqzfvscqwwldpv sslmode=require"; do
  if "$PSQL" "$CONN" -At -c "select 1" >/dev/null 2>&1; then break; fi; CONN=""
done
[ -n "$CONN" ] || { echo "não foi possível conectar ao banco de produção"; exit 1; }
echo "conectado: $(echo "$CONN" | cut -d' ' -f1) · projeto trkwfwvqzfvscqwwldpv (carioca-drift) · banco $("$PSQL" "$CONN" -At -c "select current_database()")"
if "$PSQL" "$CONN" -At -c "select 1 from pg_tables where schemaname='public' and tablename='interessados_carona'" | grep -q 1; then
  echo "a tabela interessados_carona já existe: nada a fazer"; exit 0
fi
"$PSQL" "$CONN" -v ON_ERROR_STOP=1 --single-transaction -q -f "$ARQ"
echo "migration aplicada. Objetos:"
"$PSQL" "$CONN" -At -c "select 'tabela '||tablename from pg_tables where schemaname='public' and tablename in ('interessados_carona','tentativas_carona')" \
  -c "select 'policy '||policyname||' ['||cmd||']' from pg_policies where tablename='interessados_carona'" \
  -c "select 'privilégios '||grantee||': '||string_agg(privilege_type||'('||coalesce(column_name,'*')||')', ', ') from information_schema.column_privileges where table_name='interessados_carona' and grantee in ('anon') group by grantee" \
  -c "select 'gatilho '||tgname from pg_trigger where tgname='interessados_carona_limite'"
