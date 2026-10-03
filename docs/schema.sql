-- ============================================================================
-- SnookerBee — database schema
-- ============================================================================
-- Run in the Supabase SQL Editor. Everything here is additive and safe to run
-- on a database that already holds matches.
--
-- If you already have the three original tables, you only need PART 2 and
-- PART 3 below.
-- ============================================================================


-- ============================================================================
-- PART 1 — Snooker matches (original schema)
-- ============================================================================

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  mode text not null,
  reds_count int not null,
  best_of int not null,
  created_at timestamptz default now(),
  duration_ms bigint not null,
  winner_name text not null
);

alter table matches enable row level security;

drop policy if exists "Users can CRUD their own matches" on matches;
create policy "Users can CRUD their own matches" on matches
  for all using (auth.uid() = user_id);

create table if not exists match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  player_name text not null,
  team_name text,
  total_score int default 0,
  highest_break int default 0,
  frames_won int default 0,
  fouls_committed int default 0,
  time_spent_ms bigint default 0
);

alter table match_players enable row level security;

drop policy if exists "Users can CRUD their own match players" on match_players;
create policy "Users can CRUD their own match players" on match_players
  for all using (
    match_id in (select id from matches where user_id = auth.uid())
  );

create table if not exists match_frames (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  frame_number int not null,
  duration_ms bigint,
  action_log jsonb
);

alter table match_frames enable row level security;

drop policy if exists "Users can CRUD their own match frames" on match_frames;
create policy "Users can CRUD their own match frames" on match_frames
  for all using (
    match_id in (select id from matches where user_id = auth.uid())
  );


-- ============================================================================
-- PART 2 — Break milestones
-- ----------------------------------------------------------------------------
-- Counts of 100+ and 50-99 breaks per player, per match. A break counts once,
-- at its highest tier: a 104 is one century, not a century and a fifty.
--
-- Until this runs, the app saves matches without these two values rather than
-- failing the save.
-- ============================================================================

alter table match_players
  add column if not exists centuries int default 0,
  add column if not exists half_centuries int default 0;


-- ============================================================================
-- PART 3 — Century games
-- ----------------------------------------------------------------------------
-- The club game, which has a different shape of result from snooker: players
-- finish in an order and one is left short, so there is no single winner
-- column. Kept in its own tables rather than bent into `matches`.
-- ============================================================================

create table if not exists century_games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  target int not null,
  created_at timestamptz default now(),
  duration_ms bigint not null default 0,
  -- null when everyone reached the target
  loser_name text
);

alter table century_games enable row level security;

drop policy if exists "Users can CRUD their own century games" on century_games;
create policy "Users can CRUD their own century games" on century_games
  for all using (auth.uid() = user_id);

create table if not exists century_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references century_games(id) on delete cascade,
  player_name text not null,
  final_score int not null default 0,
  -- finishing position; null means they never reached the target
  finished_at int,
  balls_potted int default 0,
  reds_potted int default 0,
  reds_missed int default 0,
  fouls int default 0
);

alter table century_players enable row level security;

drop policy if exists "Users can CRUD their own century players" on century_players;
create policy "Users can CRUD their own century players" on century_players
  for all using (
    game_id in (select id from century_games where user_id = auth.uid())
  );

create index if not exists century_players_game_id_idx
  on century_players (game_id);

-- Century: red value (10 or 20) and the play-by-play, added after launch.
-- Both nullable; games saved before this read as red 10 with no log.
alter table century_games add column if not exists red_value int;
alter table century_games add column if not exists action_log jsonb;

-- ============================================================================
-- PART 4 — Per-account settings (theme, accent colour, background, player
-- name). The app keeps a copy on the device; this makes it follow the account.
-- ============================================================================

create table if not exists user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table user_settings enable row level security;
drop policy if exists "Users manage their own settings" on user_settings;
create policy "Users manage their own settings" on user_settings
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);


-- ============================================================================
-- PART 4 — Frame results (2.0)
-- ----------------------------------------------------------------------------
-- Each saved frame keeps who won it and the points by player (or team), so
-- stats and the dashboard don't have to replay shot logs. Null winner = the
-- frame wasn't finished (match ended mid-frame) or was level.
--
-- Until this runs, the app saves frames without these two values.
-- ============================================================================

alter table match_frames
  add column if not exists winner_name text,
  add column if not exists scores jsonb;
