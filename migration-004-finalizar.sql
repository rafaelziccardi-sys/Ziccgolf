-- =============================================================
--  MIGRAÇÃO 004 — "Finalizar jogo": rodada só conta no ranking
--  depois de encerrada. Rode no SQL Editor. Idempotente.
-- =============================================================
alter table rounds add column if not exists finalizada boolean not null default false;

-- qualquer participante do grupo da rodada pode finalizar
create or replace function public.finalizar_rodada(p_round uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_round_member(p_round) then raise exception 'Sem permissão'; end if;
  update rounds set finalizada = true where id = p_round;
end $$;

-- só o admin do grupo pode reabrir
create or replace function public.reabrir_rodada(p_round uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_round_admin(p_round) then raise exception 'Só o admin reabre a rodada'; end if;
  update rounds set finalizada = false where id = p_round;
end $$;
