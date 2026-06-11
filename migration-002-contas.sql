-- =============================================================
--  MIGRAÇÃO 002 — contas vinculadas a jogadores + placar ao vivo
--  Cada conta só edita o PRÓPRIO score. Rode no SQL Editor.
-- =============================================================

-- 1) Vincular jogador <-> conta de login
alter table players add column if not exists auth_user_id uuid references auth.users(id) on delete set null;
create unique index if not exists uq_players_auth on players(auth_user_id) where auth_user_id is not null;

-- 2) Helper: o jogador "pid" pertence ao usuário logado?
create or replace function public.is_my_player(pid uuid)
returns boolean language sql security definer stable as $$
  select exists (select 1 from players p where p.id = pid and p.auth_user_id = auth.uid());
$$;

-- 3) PLAYERS — todos leem; cada um só cria/edita o próprio
drop policy if exists grupo_logado_escreve on players;
create policy players_insert_own on players for insert  with check (auth_user_id = auth.uid());
create policy players_update_own on players for update  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

-- 4) ROUND_PARTICIPANTS — todos leem; cada um só mexe na própria linha
drop policy if exists grupo_logado_escreve on round_participants;
create policy rp_insert_own on round_participants for insert with check (is_my_player(player_id));
create policy rp_update_own on round_participants for update using (is_my_player(player_id)) with check (is_my_player(player_id));
create policy rp_delete_own on round_participants for delete using (is_my_player(player_id));

-- 5) HOLE_SCORES — idem (cada um só o próprio)
drop policy if exists grupo_logado_escreve on hole_scores;
create policy hs_insert_own on hole_scores for insert with check (is_my_player(player_id));
create policy hs_update_own on hole_scores for update using (is_my_player(player_id)) with check (is_my_player(player_id));
create policy hs_delete_own on hole_scores for delete using (is_my_player(player_id));

-- rounds, individual_matches e team_matches continuam editáveis por qualquer
-- pessoa logada (mantém a policy "grupo_logado_escreve" original).

-- =============================================================
-- 6) COMEÇAR DO ZERO — apaga jogadores e rodadas de teste.
--    >>> Rode estas 2 linhas só se confirma que quer zerar tudo:
-- =============================================================
delete from rounds;
delete from players;
