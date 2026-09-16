create table public.confirmacoes (
  id bigint generated always as identity primary key,
  evento text not null default 'open-drift-session-2026-09-20',
  nome text not null check (char_length(nome) between 2 and 80),
  telefone text not null check (telefone ~ '^[0-9]{10,11}$'),
  criado_em timestamptz not null default now()
);
create unique index confirmacoes_evento_telefone on public.confirmacoes (evento, telefone);
alter table public.confirmacoes enable row level security;
-- visitantes só podem inserir; ninguém lê pela chave pública
create policy "anon insere confirmacao" on public.confirmacoes
  for insert to anon with check (true);
