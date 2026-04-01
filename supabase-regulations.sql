-- ═══════════════════════════════════════════════════════════════════
-- MUHTAWA — Regulations Knowledge Base Migration
-- Run this in Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- ── Regulations table ────────────────────────────────────────────
create table if not exists public.regulations (
  id uuid default uuid_generate_v4() primary key,
  source text not null check (source in ('LCGPA', 'EXPRO')),
  title text not null,
  category text not null,
  subcategory text,
  document_name text,
  article_numbers text,
  content text not null,
  summary text,
  effective_date date,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Full-text search index for fast keyword matching ─────────────
alter table public.regulations add column if not exists
  search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(category, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'C')
  ) stored;

create index if not exists idx_regulations_search on public.regulations using gin(search_vector);
create index if not exists idx_regulations_source on public.regulations(source);
create index if not exists idx_regulations_category on public.regulations(category);
create index if not exists idx_regulations_active on public.regulations(is_active);

-- ── Row Level Security ──────────────────────────────────────────
alter table public.regulations enable row level security;

-- Everyone authenticated can read regulations (they power the AI advisor)
create policy "Authenticated users can read regulations"
  on public.regulations for select
  using (auth.uid() is not null);

-- Only admin can insert/update/delete (enforced in app code by email check)
create policy "Admin can manage regulations"
  on public.regulations for all
  using (auth.uid() is not null);

-- ── Helper function: search regulations by query ─────────────────
create or replace function search_regulations(query text, max_results int default 5)
returns setof regulations
language sql
as $$
  select *
  from regulations
  where is_active = true
    and search_vector @@ plainto_tsquery('english', query)
  order by ts_rank(search_vector, plainto_tsquery('english', query)) desc
  limit max_results;
$$;
