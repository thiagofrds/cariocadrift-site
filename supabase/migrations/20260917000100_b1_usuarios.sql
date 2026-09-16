-- ETAPA B · B1: perfis de usuário, handles reservados e histórico de ações do usuário.
-- Só em DEV. Reversão: drop table public.acoes_usuario, public.handles_reservados, public.usuarios cascade;

create table public.usuarios (
  id               uuid primary key references auth.users (id) on delete cascade,
  handle           text unique check (handle ~ '^[a-z0-9][a-z0-9_]{1,22}[a-z0-9]$' and handle !~ '__'),
  nome             text not null check (char_length(btrim(nome)) between 2 and 120),
  nome_exibicao    text not null check (char_length(btrim(nome_exibicao)) between 2 and 40),
  preferencia      text not null check (preferencia in ('piloto', 'espectador')),
  apresentacao     text check (char_length(apresentacao) <= 400),
  instagram        text check (instagram ~ '^[a-z0-9._]{1,30}$'),
  avatar_path      text check (avatar_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$'),
  telefone         text check (telefone ~ '^[0-9]{10,11}$'),
  perfil_publico   boolean not null default false,
  estado_cadastro  text not null default 'completo' check (estado_cadastro in ('handle_pendente', 'completo')),
  aceite_termos_em timestamptz,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  constraint usuarios_handle_ou_pendente check (handle is not null or estado_cadastro = 'handle_pendente'),
  constraint usuarios_publico_exige_handle check (perfil_publico = false or handle is not null)
);
comment on table public.usuarios is 'Perfil de conta única. Piloto/espectador é preferência, não papel. Nasce privado.';
create index usuarios_perfil_publico on public.usuarios (handle) where perfil_publico;
create trigger usuarios_atualizado_em before update on public.usuarios for each row execute function public.toca_atualizado_em();

alter table public.usuarios enable row level security;
create policy "usuarios: dono le" on public.usuarios for select to authenticated using (id = auth.uid());
create policy "usuarios: admin le" on public.usuarios for select to authenticated using (public.eh_admin());
-- UPDATE direto só do dono, só com cadastro completo, e a foto só na própria pasta. Colunas limitadas por privilégio (abaixo).
create policy "usuarios: dono edita" on public.usuarios for update to authenticated
  using (id = auth.uid() and estado_cadastro = 'completo')
  with check (id = auth.uid() and (avatar_path is null or avatar_path like auth.uid()::text || '/%'));
-- sem INSERT/DELETE pela API: o perfil nasce pelo gatilho de auth.users e morre com a conta (cascade)

revoke all on public.usuarios from anon, authenticated;
grant select on public.usuarios to authenticated;
grant update (nome, nome_exibicao, preferencia, apresentacao, instagram, avatar_path, telefone) on public.usuarios to authenticated;

-- handles reservados: termos administrativos e confusos; editável por admin (etapa posterior via painel)
create table public.handles_reservados (handle text primary key, motivo text);
insert into public.handles_reservados (handle, motivo) values
  ('admin','administrativo'),('administrador','administrativo'),('administracao','administrativo'),('suporte','administrativo'),('staff','administrativo'),
  ('organizacao','administrativo'),('oficial','confuso'),('official','confuso'),('cariocadrift','marca'),('carioca_drift','marca'),('cariocadriftculture','marca'),
  ('carioca','marca'),('drift','marca'),('driftculture','marca'),('fotografo','papel'),('fotografos','papel'),('piloto','papel'),('pilotos','papel'),
  ('ingressos','rota'),('ingresso','rota'),('media','rota'),('treinos','rota'),('treino','rota'),('escolinha','rota'),('caronas','rota'),('carona','rota'),
  ('sobre','rota'),('conta','rota'),('login','rota'),('entrar','rota'),('sair','rota'),('cadastro','rota'),('perfil','rota'),('u','rota'),('api','rota'),
  ('assets','rota'),('painel','rota'),('null','confuso'),('undefined','confuso'),('root','confuso'),('sistema','confuso'),('teste','confuso');
alter table public.handles_reservados enable row level security;
revoke all on public.handles_reservados from anon, authenticated;

-- histórico de ações do próprio usuário (troca de handle, visibilidade); só funções gravam
create table public.acoes_usuario (
  id         bigserial primary key,
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  acao       text not null,
  contexto   jsonb not null default '{}'::jsonb,
  criado_em  timestamptz not null default now()
);
create index acoes_usuario_usuario on public.acoes_usuario (usuario_id, criado_em desc);
alter table public.acoes_usuario enable row level security;
create policy "acoes_usuario: dono le" on public.acoes_usuario for select to authenticated using (usuario_id = auth.uid());
revoke all on public.acoes_usuario from anon, authenticated;
grant select on public.acoes_usuario to authenticated;
