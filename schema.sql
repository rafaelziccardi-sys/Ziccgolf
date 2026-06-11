-- =============================================================
--  GOLF CLUB - Schema do banco (Supabase / Postgres)
--  Cole este arquivo inteiro no SQL Editor do Supabase e rode.
-- =============================================================

-- ---------- JOGADORES ----------
create table if not exists players (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  foto_url    text,
  handicap    numeric,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

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

do $$
declare t text;
begin
  foreach t in array array['players','rounds','round_participants','hole_scores','individual_matches','team_matches']
  loop
    execute format(
      'create policy "grupo_logado_le"  on %I for select using (auth.role() = ''authenticated'');', t);
    execute format(
      'create policy "grupo_logado_escreve" on %I for all using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'');', t);
  end loop;
end $$;
