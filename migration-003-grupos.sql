-- =============================================================
--  MIGRAÇÃO 003 — Ziccgolf multi-grupos (multi-tenant) + admin
--  Auto-suficiente e idempotente: pode rodar mesmo que a 002
--  não tenha rodado, e pode rodar de novo sem erro.
--  Rode TUDO no SQL Editor do Supabase.
-- =============================================================

-- ---------- conta <-> jogador (caso a 002 não tenha rodado) ----------
alter table players add column if not exists auth_user_id uuid references auth.users(id) on delete set null;
create unique index if not exists uq_players_auth on players(auth_user_id) where auth_user_id is not null;

-- ---------- tabelas de grupos ----------
create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  codigo text unique not null,
  criado_em timestamptz not null default now()
);
create table if not exists group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  role text not null default 'member',
  status text not null default 'pending',
  criado_em timestamptz not null default now(),
  unique (group_id, player_id)
);
alter table rounds add column if not exists group_id uuid references groups(id) on delete cascade;
create index if not exists idx_rounds_group on rounds(group_id);
create index if not exists idx_gm_group on group_members(group_id);
create index if not exists idx_gm_player on group_members(player_id);

-- ---------- funções auxiliares ----------
create or replace function public.my_player_id() returns uuid
  language sql security definer stable set search_path = public as $$
  select id from players where auth_user_id = auth.uid() limit 1; $$;

create or replace function public.is_my_player(pid uuid) returns boolean
  language sql security definer stable set search_path = public as $$
  select exists (select 1 from players p where p.id = pid and p.auth_user_id = auth.uid()); $$;

create or replace function public.is_group_member(gid uuid) returns boolean
  language sql security definer stable set search_path = public as $$
  select exists (select 1 from group_members m where m.group_id = gid and m.player_id = my_player_id() and m.status = 'approved'); $$;

create or replace function public.is_group_admin(gid uuid) returns boolean
  language sql security definer stable set search_path = public as $$
  select exists (select 1 from group_members m where m.group_id = gid and m.player_id = my_player_id() and m.status = 'approved' and m.role = 'admin'); $$;

create or replace function public.is_round_member(rid uuid) returns boolean
  language sql security definer stable set search_path = public as $$
  select exists (select 1 from rounds r join group_members m on m.group_id = r.group_id
    where r.id = rid and m.player_id = my_player_id() and m.status = 'approved'); $$;

create or replace function public.is_round_admin(rid uuid) returns boolean
  language sql security definer stable set search_path = public as $$
  select exists (select 1 from rounds r join group_members m on m.group_id = r.group_id
    where r.id = rid and m.player_id = my_player_id() and m.status = 'approved' and m.role = 'admin'); $$;

-- ---------- RPCs ----------
create or replace function public.aplicar_por_codigo(p_codigo text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare gid uuid; gnome text; pid uuid; st text;
begin
  select id, nome into gid, gnome from groups where codigo = upper(trim(p_codigo));
  if gid is null then raise exception 'Código inválido'; end if;
  pid := my_player_id();
  if pid is null then raise exception 'Crie seu jogador primeiro'; end if;
  insert into group_members (group_id, player_id, role, status) values (gid, pid, 'member', 'pending')
    on conflict (group_id, player_id) do nothing;
  select status into st from group_members where group_id = gid and player_id = pid;
  return jsonb_build_object('group_id', gid, 'nome', gnome, 'status', st);
end $$;

create or replace function public.criar_grupo(p_nome text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare gid uuid; pid uuid; cod text; email text;
begin
  email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if email not in ('rafael.ziccardi@gmail.com') then
    raise exception 'Sem permissão para criar grupo'; end if;
  pid := my_player_id();
  if pid is null then raise exception 'Crie seu jogador primeiro'; end if;
  cod := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  insert into groups (nome, codigo) values (p_nome, cod) returning id into gid;
  insert into group_members (group_id, player_id, role, status) values (gid, pid, 'admin', 'approved');
  return jsonb_build_object('group_id', gid, 'nome', p_nome, 'codigo', cod);
end $$;

-- ---------- RLS ----------
alter table players            enable row level security;
alter table rounds             enable row level security;
alter table round_participants enable row level security;
alter table hole_scores        enable row level security;
alter table individual_matches enable row level security;
alter table team_matches       enable row level security;
alter table groups             enable row level security;
alter table group_members      enable row level security;

-- limpa policies antigas/novas (idempotente)
drop policy if exists grupo_logado_le on players;
drop policy if exists grupo_logado_escreve on players;
drop policy if exists players_insert_own on players;
drop policy if exists players_update_own on players;
drop policy if exists grupo_logado_le on rounds;
drop policy if exists grupo_logado_escreve on rounds;
drop policy if exists rounds_select on rounds; drop policy if exists rounds_insert on rounds;
drop policy if exists rounds_update on rounds; drop policy if exists rounds_delete on rounds;
drop policy if exists grupo_logado_le on round_participants;
drop policy if exists grupo_logado_escreve on round_participants;
drop policy if exists rp_insert_own on round_participants; drop policy if exists rp_update_own on round_participants; drop policy if exists rp_delete_own on round_participants;
drop policy if exists rp_select on round_participants; drop policy if exists rp_insert on round_participants; drop policy if exists rp_update on round_participants; drop policy if exists rp_delete on round_participants;
drop policy if exists grupo_logado_le on hole_scores;
drop policy if exists grupo_logado_escreve on hole_scores;
drop policy if exists hs_insert_own on hole_scores; drop policy if exists hs_update_own on hole_scores; drop policy if exists hs_delete_own on hole_scores;
drop policy if exists hs_select on hole_scores; drop policy if exists hs_insert on hole_scores; drop policy if exists hs_update on hole_scores; drop policy if exists hs_delete on hole_scores;
drop policy if exists grupo_logado_le on individual_matches; drop policy if exists grupo_logado_escreve on individual_matches;
drop policy if exists im_select on individual_matches; drop policy if exists im_write on individual_matches; drop policy if exists im_delete on individual_matches;
drop policy if exists grupo_logado_le on team_matches; drop policy if exists grupo_logado_escreve on team_matches;
drop policy if exists tm_select on team_matches; drop policy if exists tm_write on team_matches; drop policy if exists tm_delete on team_matches;
drop policy if exists groups_select on groups; drop policy if exists groups_update on groups;
drop policy if exists gm_select on group_members; drop policy if exists gm_update on group_members; drop policy if exists gm_delete on group_members;

-- PLAYERS: todos logados leem; cada um cria/edita o próprio
create policy grupo_logado_le on players for select using (auth.role() = 'authenticated');
create policy players_insert_own on players for insert with check (auth_user_id = auth.uid());
create policy players_update_own on players for update using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

-- GROUPS / GROUP_MEMBERS
create policy groups_select on groups for select using (is_group_member(id));
create policy groups_update on groups for update using (is_group_admin(id)) with check (is_group_admin(id));
create policy gm_select on group_members for select using (is_group_member(group_id) or player_id = my_player_id());
create policy gm_update on group_members for update using (is_group_admin(group_id)) with check (is_group_admin(group_id));
create policy gm_delete on group_members for delete using (is_group_admin(group_id) or player_id = my_player_id());

-- ROUNDS (por grupo)
create policy rounds_select on rounds for select using (is_group_member(group_id));
create policy rounds_insert on rounds for insert with check (is_group_member(group_id));
create policy rounds_update on rounds for update using (is_group_admin(group_id)) with check (is_group_admin(group_id));
create policy rounds_delete on rounds for delete using (is_group_admin(group_id));

-- ROUND_PARTICIPANTS / HOLE_SCORES (próprio, ou admin do grupo)
create policy rp_select on round_participants for select using (is_round_member(round_id));
create policy rp_insert on round_participants for insert with check (is_my_player(player_id) and is_round_member(round_id));
create policy rp_update on round_participants for update using ((is_my_player(player_id) or is_round_admin(round_id)) and is_round_member(round_id)) with check ((is_my_player(player_id) or is_round_admin(round_id)) and is_round_member(round_id));
create policy rp_delete on round_participants for delete using (is_my_player(player_id) or is_round_admin(round_id));
create policy hs_select on hole_scores for select using (is_round_member(round_id));
create policy hs_insert on hole_scores for insert with check (is_my_player(player_id) and is_round_member(round_id));
create policy hs_update on hole_scores for update using ((is_my_player(player_id) or is_round_admin(round_id)) and is_round_member(round_id)) with check ((is_my_player(player_id) or is_round_admin(round_id)) and is_round_member(round_id));
create policy hs_delete on hole_scores for delete using (is_my_player(player_id) or is_round_admin(round_id));

-- MATCHES (membro do grupo da rodada)
create policy im_select on individual_matches for select using (is_round_member(round_id));
create policy im_write  on individual_matches for insert with check (is_round_member(round_id));
create policy im_delete on individual_matches for delete using (is_round_member(round_id) or is_round_admin(round_id));
create policy tm_select on team_matches for select using (is_round_member(round_id));
create policy tm_write  on team_matches for insert with check (is_round_member(round_id));
create policy tm_delete on team_matches for delete using (is_round_member(round_id) or is_round_admin(round_id));

-- =============================================================
--  (OPCIONAL) começar do zero — apaga rodadas. Descomente p/ usar:
-- delete from rounds;
-- =============================================================
