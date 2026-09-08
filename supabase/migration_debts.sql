-- Chạy trong Supabase SQL Editor (một lần) để bật nợ theo người.
create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  principal bigint not null check (principal > 0),
  created_at timestamptz not null default now()
);

alter table public.transactions
  add column if not exists debt_id uuid references public.debts(id) on delete set null;

create index if not exists debts_user_idx on public.debts(user_id);
create index if not exists transactions_debt_idx on public.transactions(debt_id);

alter table public.debts enable row level security;

drop policy if exists debts_select_own on public.debts;
drop policy if exists debts_insert_own on public.debts;
drop policy if exists debts_update_own on public.debts;
drop policy if exists debts_delete_own on public.debts;

create policy debts_select_own on public.debts for select using (auth.uid() = user_id);
create policy debts_insert_own on public.debts for insert with check (auth.uid() = user_id);
create policy debts_update_own on public.debts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy debts_delete_own on public.debts for delete using (auth.uid() = user_id);
