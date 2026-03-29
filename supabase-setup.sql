-- ═══════════════════════════════════════════════════════════════════
-- MUHTAWA — Supabase Database Setup
-- Run this in Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── Companies table ──────────────────────────────────────────────
create table if not exists public.companies (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  sector text,
  cr_number text,
  address text,
  contact_name text,
  contact_email text,
  contact_phone text,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- One company per user
  constraint companies_user_id_unique unique (user_id)
);

-- ── Assessments table ────────────────────────────────────────────
create table if not exists public.assessments (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  assessment_data jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Indexes ──────────────────────────────────────────────────────
create index if not exists idx_companies_user_id on public.companies(user_id);
create index if not exists idx_assessments_user_id on public.assessments(user_id);
create index if not exists idx_assessments_created on public.assessments(created_at desc);

-- ── Row Level Security ──────────────────────────────────────────
alter table public.companies enable row level security;
alter table public.assessments enable row level security;

-- Companies: users can only access their own
create policy "Users can view own company"
  on public.companies for select
  using (auth.uid() = user_id);

create policy "Users can insert own company"
  on public.companies for insert
  with check (auth.uid() = user_id);

create policy "Users can update own company"
  on public.companies for update
  using (auth.uid() = user_id);

create policy "Users can delete own company"
  on public.companies for delete
  using (auth.uid() = user_id);

-- Assessments: users can only access their own
create policy "Users can view own assessments"
  on public.assessments for select
  using (auth.uid() = user_id);

create policy "Users can insert own assessments"
  on public.assessments for insert
  with check (auth.uid() = user_id);

create policy "Users can update own assessments"
  on public.assessments for update
  using (auth.uid() = user_id);

create policy "Users can delete own assessments"
  on public.assessments for delete
  using (auth.uid() = user_id);

-- ── Done ─────────────────────────────────────────────────────────
-- You're all set. The app will handle everything else.
