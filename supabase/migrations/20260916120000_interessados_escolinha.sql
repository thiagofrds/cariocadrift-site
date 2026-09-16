create table public.interessados_escolinha (
  id bigint generated always as identity primary key,
  nome text not null check (char_length(nome) between 2 and 80),
  telefone text not null check (telefone ~ '^[0-9]{10,11}$'),
  mensagem text check (char_length(mensagem) <= 500),
  criado_em timestamptz not null default now()
);
create unique index interessados_escolinha_telefone on public.interessados_escolinha (telefone);
alter table public.interessados_escolinha enable row level security;
create policy "anon registra interesse" on public.interessados_escolinha
  for insert to anon with check (true);
