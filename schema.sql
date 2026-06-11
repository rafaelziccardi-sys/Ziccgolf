-- =============================================================
--  GOLF CLUB - Schema do banco (Supabase / Postgres)
--  Cole este arquivo inteiro no SQL Editor do Supabase e rode.
-- =============================================================

-- ---------- JOGADORES ----------
create table if not exists players (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  foto_url      text,
  handicap      numeric,
  ativo         boolean not null default true,
  auth_user_id  uuid references auth.users(id) on delete set null,  -- conta de login vinculada
  criado_em     timestamptz not null default now()
);
create unique index if not exists uq_players_auth on players(auth_user_id) where auth_user_id is not null;

-- ---------- RODADAS ----------
create table if not exists rounds (
  id           uuid primary key default gen_random_uuid(),
  data         date not null,
  observacoes  text,
  -- 'simples' = stats agregadas por rodada | 'detalhado' = buraco a buraco (v2)
  modo         text not null default 'simples',
  criado_em    timestamptz not null default now()
);

-- ---------- PARTICIPACAO NA RODADA (Stroke Play + stats agregadas) ----------
create table if not exists round_participants (
  id            uuid primary key default gen_random_uuid(),
  round_id      uuid not null references rounds(id) on delete cascade,
  player_id     uuid not null references players(id) on delete cascade,
  gross_score   int,            -- score bruto Stroke Play
  posicao       int,            -- colocação no dia (calculada)
  putts         int,            -- total de putts (modo simples)
  fairways_hit  int,            -- fairways acertados
  fairways_tot  int,            -- fairways possíveis (ex: 14)
  gir           int,            -- greens in regulation acertados
  gir_tot       int default 18, -- greens possíveis
  bunker_total int default 0,    -- tacadas dadas de dentro do bunker (areia)
  pontos_stroke      int default 0,
  pontos_match_ind   int default 0,
  pontos_match_dupla int default 0,
  unique (round_id, player_id)
);

-- ---------- SCORE POR BURACO (VAZIO no MVP; destrava v2 + Strokes Gained) ----------
create table if not exists hole_scores (
  id           uuid primary key default gen_random_uuid(),
  round_id     uuid not null references rounds(id) on delete cascade,
  player_id    uuid not null references players(id) on delete cascade,
  buraco       int not null,            -- 1..18
  par          int,
  strokes      int,
  putts        int,
  bunker       int default 0,    -- tacadas dadas de dentro do bunker (areia)
  fairway_hit  boolean,
  gir          boolean,
  penalidades  int default 0,
  obs          text,
  unique (round_id, player_id, buraco)
);

-- ---------- MATCH PLAY INDIVIDUAL (1 vs 1) ----------
create table if not exists individual_matches (
  id          uuid primary key default gen_random_uuid(),
  round_id    uuid not null references rounds(id) on delete cascade,
  player_a    uuid not null references players(id) on delete cascade,
  player_b    uuid not null references players(id) on delete cascade,
  resultado   text not null,   -- 'A' (A venceu) | 'B' (B venceu) | 'EMPATE'
  placar      text             -- opcional, ex: "3&2"
);

-- ---------- MATCH PLAY DE DUPLAS (2 vs 2) ----------
create table if not exists team_matches (
  id          uuid primary key default gen_random_uuid(),
  round_id    uuid not null references rounds(id) on delete cascade,
  t1_p1       uuid not null references players(id) on delete cascade,
  t1_p2       uuid not null references players(id) on delete cascade,
  t2_p1       uuid not null references players(id) on delete cascade,
  t2_p2       uuid not null references players(id) on delete cascade,
  resultado   text not null,   -- 'T1' | 'T2' | 'EMPATE'
  placar      text
);

create index if not exists idx_rp_round   on round_participants(round_id);
create index if not exists idx_rp_player  on round_participants(player_id);
create index if not exists idx_hs_round   on hole_scores(round_id);
create index if not exists idx_im_round   on individual_matches(round_id);
create index if not exists idx_tm_round   on team_matches(round_id);

-- =============================================================
--  SEGURANCA (RLS): só usuários logados leem/escrevem.
--  Para uso de grupo privado, isto basta: quem tem login do
--  grupo pode tudo; quem não tem, não acessa nada.
-- =============================================================
alter table players            enable row level security;
alter table rounds             enable row level security;
alter table round_participants enable row level security;
alter table hole_scores        enable row level security;
alter table individual_matches enable row level security;
alter table team_matches       enable row level security;

-- Leitura: todo mundo logado vê tudo (placar ao vivo do grupo).
do $$
declare t text;
begin
  foreach t in array array['players','rounds','round_participants','hole_scores','individual_matches','team_matches']
  loop
    execute format('create policy "grupo_logado_le" on %I for select using (auth.role() = ''authenticated'');', t);
  end loop;
end $$;

-- Escrita ampla (qualquer logado): rodadas e confrontos.
create policy "grupo_logado_escreve" on rounds            for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "grupo_logado_escreve" on individual_matches for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "grupo_logado_escreve" on team_matches       for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Helper: o jogador "pid" pertence ao usuário logado?
create or replace function public.is_my_player(pid uuid)
returns boolean language sql security definer stable as $$
  select exists (select 1 from players p where p.id = pid and p.auth_user_id = auth.uid());
$$;

-- Escrita restrita ao dono: cada conta só cria/edita o PRÓPRIO jogador e score.
create policy players_insert_own on players for insert with check (auth_user_id = auth.uid());
create policy players_update_own on players for update using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

create policy rp_insert_own on round_participants for insert with check (is_my_player(player_id));
create policy rp_update_own on round_participants for update using (is_my_player(player_id)) with check (is_my_player(player_id));
create policy rp_delete_own on round_participants for delete using (is_my_player(player_id));

create policy hs_insert_own on hole_scores for insert with check (is_my_player(player_id));
create policy hs_update_own on hole_scores for update using (is_my_player(player_id)) with check (is_my_player(player_id));
create policy hs_delete_own on hole_scores for delete using (is_my_player(player_id));
