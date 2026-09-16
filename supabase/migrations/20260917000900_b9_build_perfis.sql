-- ETAPA B · B9: registro e limite das chamadas da Edge Function de build de perfis (60 por hora, plano 4.2 item 2).
-- A tabela não tem acesso pela API; só a função, executável apenas por service_role (a Edge Function).
-- Reversão: drop function public.registra_chamada_build(text); drop table public.chamadas_build;
create table public.chamadas_build (
  criado_em timestamptz not null default now(),
  origem    text
);
create index chamadas_build_criado_em on public.chamadas_build (criado_em);
alter table public.chamadas_build enable row level security;
revoke all on public.chamadas_build from public, anon, authenticated;

create or replace function public.registra_chamada_build(origem_txt text default null) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext('chamadas_build'));
  if (select count(*) from public.chamadas_build where criado_em > now() - interval '1 hour') >= 60 then return false; end if;
  insert into public.chamadas_build (origem) values (left(origem_txt, 200));
  delete from public.chamadas_build where criado_em < now() - interval '1 day';
  return true;
end $$;
revoke all on function public.registra_chamada_build(text) from public, anon, authenticated;
grant execute on function public.registra_chamada_build(text) to service_role;
