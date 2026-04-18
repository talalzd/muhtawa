-- Supabase migration — run this in the SQL editor.
-- Creates the rate-limits table used by /api/chat to throttle requests per user.

create table if not exists api_rate_limits (
  id         bigserial primary key,
  user_id    uuid        not null,
  endpoint   text        not null,
  ts         timestamptz not null default now()
);

-- Index on (user_id, endpoint, ts desc) for fast "how many requests
-- from this user in the last N seconds" queries.
create index if not exists api_rate_limits_lookup_idx
  on api_rate_limits (user_id, endpoint, ts desc);

-- Lock the table down. The service role (used by /api/chat.js) bypasses
-- RLS, so the endpoint can still read/write. End users cannot query it
-- even with a valid anon/user JWT — they have no policies granting access.
alter table api_rate_limits enable row level security;
