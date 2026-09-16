#!/bin/zsh
# Baixa as listas em CSV (usa a chave secreta em .env.local, que não vai pro git).
cd "$(dirname "$0")" && export $(grep SUPABASE_SECRET_KEY .env.local)
DIA=$(date +%Y-%m-%d)
baixa() {  # tabela colunas arquivo
  curl -s "https://trkwfwvqzfvscqwwldpv.supabase.co/rest/v1/$1?select=$2&order=criado_em.asc" \
    -H "apikey: $SUPABASE_SECRET_KEY" -H "Authorization: Bearer $SUPABASE_SECRET_KEY" -H "Accept: text/csv" > "$3"
  echo "Salvo em $3 ($(($(grep -c . "$3") - 1)) registros)"
}
baixa confirmacoes nome,telefone,evento,criado_em "confirmacoes-treino-$DIA.csv"
baixa interessados_escolinha nome,telefone,mensagem,criado_em "interessados-escolinha-$DIA.csv"
