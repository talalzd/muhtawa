-- ═══════════════════════════════════════════════════════════════════
-- MUHTAWA — Phase 2 Migration
-- Run this in Supabase Dashboard → SQL Editor AFTER the initial setup
-- ═══════════════════════════════════════════════════════════════════

-- ── Feedback table ───────────────────────────────────────────────
create table if not exists public.feedback (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete set null,
  email text,
  message text not null,
  page text,
  created_at timestamptz default now()
);

create index if not exists idx_feedback_created on public.feedback(created_at desc);

alter table public.feedback enable row level security;

-- Anyone authenticated can insert feedback
create policy "Authenticated users can insert feedback"
  on public.feedback for insert
  with check (auth.uid() is not null);

-- Only the user can see their own feedback (optional, for "my feedback" feature)
create policy "Users can view own feedback"
  on public.feedback for select
  using (auth.uid() = user_id);
