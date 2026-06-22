-- ============================================================
-- MEDORA CLINIC OS — PHASE 3 MIGRATION
-- Appointments & Scheduling System
-- Run this in Supabase SQL Editor AFTER Phase 1 + Phase 2
-- ============================================================

-- ============================================================
-- EXTEND APPOINTMENTS TABLE
-- Add custom_type_label column for custom appointment types
-- ============================================================
alter table public.appointments
  add column if not exists custom_type_label text;

-- ============================================================
-- UPDATE CHECK CONSTRAINTS
-- Add check_up + custom types, and checked_in status
-- ============================================================

-- Drop existing check constraints dynamically
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.appointments'::regclass
    and contype = 'c'
  loop
    execute format('alter table public.appointments drop constraint if exists %I', c.conname);
  end loop;
end $$;

-- Re-add all constraints with extended values
alter table public.appointments
  add constraint appointments_type_check
  check (type in ('consultation', 'follow_up', 'procedure', 'check_up', 'emergency', 'custom'));

alter table public.appointments
  add constraint appointments_status_check
  check (status in ('scheduled', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show'));

alter table public.appointments
  add constraint appointments_duration_check
  check (duration_minutes > 0);

-- ============================================================
-- ROW LEVEL SECURITY — APPOINTMENTS
-- Phase 3: permissive policies (no auth yet)
-- ============================================================
drop policy if exists "appointments_phase2_all" on public.appointments;
drop policy if exists "appointments_all" on public.appointments;

create policy "appointments_phase3_all"
  on public.appointments
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- ============================================================
-- ROW LEVEL SECURITY — DOCTORS
-- ============================================================
drop policy if exists "doctors_all" on public.doctors;
drop policy if exists "doctors_phase3_all" on public.doctors;

create policy "doctors_phase3_all"
  on public.doctors
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- ============================================================
-- ADDITIONAL INDEXES FOR SCHEDULING QUERIES
-- ============================================================
create index if not exists idx_appts_date_doctor
  on public.appointments(doctor_id, scheduled_at);

create index if not exists idx_appts_date_range
  on public.appointments(scheduled_at, status);

-- ============================================================
-- CONFLICT PREVENTION FUNCTION (server-side validation)
-- Returns true if a conflict exists for the given slot
-- ============================================================
create or replace function public.appointment_conflicts(
  p_doctor_id   uuid,
  p_start       timestamptz,
  p_duration    integer,
  p_exclude_id  uuid default null
)
returns boolean language sql stable security definer as $$
  select exists (
    select 1
    from public.appointments
    where doctor_id = p_doctor_id
      and status not in ('cancelled', 'no_show')
      and (id is distinct from p_exclude_id)
      and scheduled_at < p_start + (p_duration || ' minutes')::interval
      and scheduled_at + (duration_minutes || ' minutes')::interval > p_start
  );
$$;
