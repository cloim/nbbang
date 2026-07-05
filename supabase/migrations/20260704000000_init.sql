-- nBBang schema
-- Supabase SQL Editor에서 실행하세요.

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  name text not null,
  is_treasurer boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  title text not null,
  payer_id uuid not null references public.members (id) on delete restrict,
  amount integer not null check (amount >= 0),
  created_at timestamptz not null default now()
);

-- amount가 null이면 균등 분배 대상, 값이 있으면 해당 인원 고정 분담액
create table if not exists public.expense_shares (
  expense_id uuid not null references public.expenses (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  amount integer check (amount >= 0),
  primary key (expense_id, member_id)
);

create index if not exists idx_members_meeting on public.members (meeting_id);
create index if not exists idx_expenses_meeting on public.expenses (meeting_id);
create index if not exists idx_shares_member on public.expense_shares (member_id);

alter table public.meetings enable row level security;
alter table public.members enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_shares enable row level security;

create policy "meetings_select" on public.meetings
  for select using (owner_id = auth.uid());
create policy "meetings_insert" on public.meetings
  for insert with check (owner_id = auth.uid());
create policy "meetings_update" on public.meetings
  for update using (owner_id = auth.uid());
create policy "meetings_delete" on public.meetings
  for delete using (owner_id = auth.uid());

create policy "members_all" on public.members
  for all using (
    exists (select 1 from public.meetings m where m.id = meeting_id and m.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.meetings m where m.id = meeting_id and m.owner_id = auth.uid())
  );

create policy "expenses_all" on public.expenses
  for all using (
    exists (select 1 from public.meetings m where m.id = meeting_id and m.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.meetings m where m.id = meeting_id and m.owner_id = auth.uid())
  );

create policy "expense_shares_all" on public.expense_shares
  for all using (
    exists (
      select 1 from public.expenses e
      join public.meetings m on m.id = e.meeting_id
      where e.id = expense_id and m.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.expenses e
      join public.meetings m on m.id = e.meeting_id
      where e.id = expense_id and m.owner_id = auth.uid()
    )
  );
