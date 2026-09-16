-- Simulação mínima do ambiente Supabase num Postgres local isolado: papéis de API, auth.jwt() lido das claims da sessão,
-- tabela auth.users (para o gatilho de criação de perfil) e stubs de storage.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'dono') then create role dono login nosuperuser nobypassrls createrole; end if;
end $$;
grant anon, authenticated, service_role to harness, dono;
create schema auth;
create or replace function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
create or replace function auth.role() returns text language sql stable as $$ select auth.jwt() ->> 'role' $$;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, created_at timestamptz default now());
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant usage on schema public, auth, storage to anon, authenticated, service_role, dono;
grant all on schema public, storage to dono;
grant all on all tables in schema storage to dono; alter table storage.objects owner to dono; alter table storage.buckets owner to dono;
grant all on auth.users to dono; alter table auth.users owner to dono;
-- privilégios padrão do Supabase: tabelas e funções novas ficam acessíveis aos papéis de API (RLS é o que protege)
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
alter default privileges for role dono in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges for role dono in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges for role dono in schema public grant execute on functions to anon, authenticated, service_role;
