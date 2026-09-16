#!/bin/zsh
# Baixa todas as confirmações em CSV (usa a chave secreta em .env.local, que não vai pro git).
cd "$(dirname "$0")" && export $(grep SUPABASE_SECRET_KEY .env.local)
OUT="confirmacoes-$(date +%Y-%m-%d).csv"
curl -s "https://trkwfwvqzfvscqwwldpv.supabase.co/rest/v1/confirmacoes?select=nome,telefone,criado_em&order=criado_em.asc" \
  -H "apikey: $SUPABASE_SECRET_KEY" -H "Authorization: Bearer $SUPABASE_SECRET_KEY" -H "Accept: text/csv" > "$OUT"
echo "Salvo em $OUT ($(($(wc -l < "$OUT") - 1)) confirmações)"
