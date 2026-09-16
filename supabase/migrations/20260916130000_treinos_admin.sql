-- Administradores do painel (quem pode criar/editar conteúdo)
create table public.admins (
  email text primary key,
  criado_em timestamptz not null default now()
);
alter table public.admins enable row level security;
create policy "admin ve lista de admins" on public.admins for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins a where lower(a.email) = lower(auth.jwt() ->> 'email'));
$$;

-- Treinos (eventos da Carioca Drift)
create table public.treinos (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  titulo text not null,
  chamada text,                      -- frase curta abaixo do título
  tipo text not null default 'Treino aberto ao público',
  data date not null,
  hora_inicio time not null default '09:00',
  hora_fim time not null default '18:00',
  local_nome text not null default 'RJ Race Park',
  endereco text not null default 'Estrada do Frutuoso, 320 · Santa Cruz, Rio de Janeiro',
  maps_url text,
  waze_url text,
  entrada_titulo text default 'Ingressos no local',
  entrada_texto text default 'Venda direto na portaria, no dia.',
  regra_titulo text default 'Capacete obrigatório',
  regra_texto text default 'Pra quem for entrar na pista ou andar de carona. Sem capacete, não roda.',
  atracoes jsonb not null default '[]'::jsonb,   -- [{"titulo":"","texto":""}]
  pista_texto text,
  pista_foto_url text,
  capa_url text,
  reel_url text,
  publicado boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index treinos_data on public.treinos (data);
alter table public.treinos enable row level security;
create policy "publico ve treinos publicados" on public.treinos for select to anon, authenticated
  using (publicado or public.eh_admin());
create policy "admin cria treinos" on public.treinos for insert to authenticated with check (public.eh_admin());
create policy "admin edita treinos" on public.treinos for update to authenticated using (public.eh_admin()) with check (public.eh_admin());
create policy "admin apaga treinos" on public.treinos for delete to authenticated using (public.eh_admin());

create or replace function public.toca_atualizado_em() returns trigger language plpgsql as $$
begin new.atualizado_em = now(); return new; end $$;
create trigger treinos_atualizado before update on public.treinos
  for each row execute function public.toca_atualizado_em();

-- Admin lê e apaga confirmações e interessados
create policy "admin le confirmacoes" on public.confirmacoes for select to authenticated using (public.eh_admin());
create policy "admin apaga confirmacoes" on public.confirmacoes for delete to authenticated using (public.eh_admin());
create policy "admin le interessados" on public.interessados_escolinha for select to authenticated using (public.eh_admin());
create policy "admin apaga interessados" on public.interessados_escolinha for delete to authenticated using (public.eh_admin());

-- Fotos (bucket público para leitura; admin envia)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy "publico ve fotos" on storage.objects for select to anon, authenticated using (bucket_id = 'fotos');
create policy "admin envia fotos" on storage.objects for insert to authenticated with check (bucket_id = 'fotos' and public.eh_admin());
create policy "admin troca fotos" on storage.objects for update to authenticated using (bucket_id = 'fotos' and public.eh_admin());
create policy "admin apaga fotos" on storage.objects for delete to authenticated using (bucket_id = 'fotos' and public.eh_admin());

-- Primeiro admin
insert into public.admins (email) values ('thiagofrds@yahoo.com.br');

-- Treino inicial: Open Drift Session 20.09
insert into public.treinos (slug, titulo, chamada, tipo, data, hora_inicio, hora_fim, local_nome, endereco, maps_url, waze_url,
  entrada_titulo, entrada_texto, regra_titulo, regra_texto, atracoes, pista_texto, pista_foto_url, capa_url, reel_url, publicado)
values ('open-drift-session', 'Open Drift Session',
  'O primeiro treino de drift aberto ao público da Carioca Drift. Um domingo inteiro de pista, carros e gente boa.',
  'Treino aberto ao público', '2026-09-20', '09:00', '18:00', 'RJ Race Park', 'Estrada do Frutuoso, 320 · Santa Cruz, Rio de Janeiro',
  'https://www.google.com/maps/search/?api=1&query=RJ%20Race%20Park%20Estrada%20do%20Frutuoso%20320%20Santa%20Cruz%20RJ',
  'https://waze.com/ul?q=RJ%20Race%20Park%20Estrada%20do%20Frutuoso%20320%20Santa%20Cruz&navigate=yes',
  'Ingressos no local', 'Venda direto na portaria do RJ Race Park, no dia.',
  'Capacete obrigatório', 'Pra quem for entrar na pista ou andar de carona. Sem capacete, não roda.',
  '[{"titulo":"Pilotos locais na pista","texto":"A galera do drift carioca andando o dia todo, do treino de iniciação até a pista completa."},
    {"titulo":"Carona radical","texto":"Sente a adrenalina do banco do carona com um piloto de verdade. Leva o capacete."},
    {"titulo":"Todos são bem-vindos","texto":"Traz a família, os amigos e o seu carro. É treino aberto: vem assistir, conhecer a cena ou andar."}]'::jsonb,
  'Traçado em três seções encadeadas: vermelha, amarela e verde. A zona de iniciação fica ao lado do estacionamento, pra quem está começando.',
  '/assets/pista.jpg', '/assets/carro.jpg', 'https://www.instagram.com/reel/DdJv7ePKg-R/', true);
