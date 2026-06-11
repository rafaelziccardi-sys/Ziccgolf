-- =============================================================
--  MIGRAÇÃO 001 — adiciona "bunker" (tacadas na areia) e o modo
--  buraco a buraco. Rode UMA vez no SQL Editor do Supabase.
-- =============================================================
alter table hole_scores        add column if not exists bunker int default 0;
alter table round_participants add column if not exists bunker_total int default 0;
