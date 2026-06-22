-- ============================================================
-- MEDORA CLINIC OS — PHASE 2 MIGRATION
-- Patient Management Module
-- Run this in Supabase SQL Editor AFTER the Phase 1 schema
-- ============================================================

-- ============================================================
-- ADD MISSING COLUMNS TO PATIENTS
-- ============================================================
alter table public.patients
  add column if not exists patient_number    text unique,
  add column if not exists emergency_contact_name  text,
  add column if not exists emergency_contact_phone text,
  add column if not exists allergies         text,
  add column if not exists notes             text;

-- ============================================================
-- PATIENT NUMBER AUTO-GENERATION
-- Generates sequential P-0001, P-0002, etc.
-- ============================================================
create sequence if not exists patient_number_seq start 1;

create or replace function public.set_patient_number()
returns trigger language plpgsql security definer as $$
begin
  if new.patient_number is null then
    new.patient_number := 'P-' || lpad(nextval('patient_number_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists patients_set_number on public.patients;
create trigger patients_set_number
  before insert on public.patients
  for each row execute function public.set_patient_number();

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- Phase 2: open access via anon key (no auth yet)
-- These will be replaced with role-based policies in Phase 3
-- ============================================================

-- Drop any existing policies first
drop policy if exists "anon_patients_all" on public.patients;
drop policy if exists "allow_all_patients" on public.patients;

-- Create permissive policy for all operations
create policy "patients_phase2_all"
  on public.patients
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- ============================================================
-- INDEX FOR PATIENT NUMBER LOOKUP
-- ============================================================
create index if not exists idx_patients_patient_number
  on public.patients(patient_number);

create index if not exists idx_patients_created_at
  on public.patients(created_at desc);

-- ============================================================
-- BACKFILL PATIENT NUMBERS FOR ANY EXISTING ROWS
-- (safe to run even if table is empty)
-- ============================================================
update public.patients
set patient_number = 'P-' || lpad(nextval('patient_number_seq')::text, 4, '0')
where patient_number is null;
