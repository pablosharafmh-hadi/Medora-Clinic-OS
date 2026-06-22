-- ─── Phase 6: Staff table ────────────────────────────────────────────────────
-- Manages non-doctor staff (admin, manager, receptionist, nurse).
-- Doctors are managed separately in the doctors table and merged in the UI.

create table if not exists public.staff (
  id           uuid        primary key default gen_random_uuid(),
  created_at   timestamptz not null    default now(),
  updated_at   timestamptz not null    default now(),
  first_name   text        not null,
  last_name    text        not null,
  role         text        not null    check (role in ('admin', 'manager', 'receptionist', 'nurse')),
  department   text,
  phone        text        not null    default '',
  email        text        not null    default '',
  employee_id  text        not null    unique,
  status       text        not null    default 'active' check (status in ('active', 'inactive', 'on_leave'))
);

alter table public.staff enable row level security;

create policy "staff_select_all" on public.staff
  for select using (true);

create policy "staff_insert_all" on public.staff
  for insert with check (true);

create policy "staff_update_all" on public.staff
  for update using (true) with check (true);

create policy "staff_delete_all" on public.staff
  for delete using (true);
