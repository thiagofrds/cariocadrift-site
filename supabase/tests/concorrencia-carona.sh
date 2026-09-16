#!/bin/sh
# Envios simultâneos contra o gatilho anti-abuso, no Postgres local isolado (cluster iniciado por rodar-local.sh).
# Cenário: 50 registros já na janela de 10 min; 40 processos inserem ao mesmo tempo telefones distintos.
# Esperado com limite 60: exatamente 10 entram e 30 são barrados (contagem exata graças ao bloqueio consultivo).
set -e; export LC_ALL=en_US.UTF-8
PG=/opt/homebrew/opt/postgresql@17/bin; S=/tmp/cdpg
psql() { "$PG/psql" -h "$S" -p 54329 -U harness -q -At "$@"; }
psql -d cd_teste -c "delete from interessados_carona; delete from tentativas_carona;"
psql -d cd_teste -c "insert into interessados_carona (evento,nome,telefone,consentimento) select 'base','Base',(21930000000+g)::text,true from generate_series(1,50) g; insert into tentativas_carona (telefone) select (21930000000+g)::text from generate_series(1,50) g;"
T=$(mktemp -d); i=1
while [ $i -le 40 ]; do
  ( psql -d cd_teste -c "set role anon; select set_config('request.jwt.claims','{\"role\":\"anon\"}',false); insert into interessados_carona (evento,nome,telefone,consentimento) values ('simult','Simult $i','2194000$(printf %04d $i)',true);" >"$T/$i.out" 2>&1 && echo ok >"$T/$i.res" || echo erro >"$T/$i.res" ) &
  i=$((i+1))
done
wait
ok=$(cat "$T"/*.res | grep -c '^ok$' || true); erro=$(cat "$T"/*.res | grep -c '^erro$' || true)
total=$(psql -d cd_teste -c "select count(*) from interessados_carona where criado_em > now() - interval '10 minutes';")
gatilho=$(cat "$T"/*.out | grep -c 'limite de envios atingido' || true)
echo "simultâneos: $ok entraram, $erro barrados ($gatilho pelo gatilho) | total na janela: $total (esperado 60)"
# telefone repetido em paralelo: 6 envios simultâneos do mesmo telefone em treinos diferentes → exatamente 3 entram
psql -d cd_teste -c "delete from interessados_carona; delete from tentativas_carona;"
rm -rf "$T"; T=$(mktemp -d); i=1
while [ $i -le 6 ]; do
  ( psql -d cd_teste -c "set role anon; select set_config('request.jwt.claims','{\"role\":\"anon\"}',false); insert into interessados_carona (evento,nome,telefone,consentimento) values ('treino-$i','Mesmo Fone','21955550000',true);" >/dev/null 2>&1 && echo ok >"$T/$i.res" || echo erro >"$T/$i.res" ) &
  i=$((i+1))
done
wait
echo "mesmo telefone em paralelo: $(cat "$T"/*.res | grep -c '^ok$') entraram (esperado 3), $(cat "$T"/*.res | grep -c '^erro$') barrados (esperado 3)"
rm -rf "$T"
