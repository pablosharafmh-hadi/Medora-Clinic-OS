-- ============================================================
-- MEDORA CLINIC OS — PHASE 4 MIGRATION
-- Medical Records System
-- Run in Supabase SQL Editor AFTER Phase 1, 2, and 3
-- ============================================================

-- ============================================================
-- MEDICAL RECORDS TABLE
-- ============================================================
create table if not exists public.medical_records (
  id                 uuid primary key default uuid_generate_v4(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  patient_id         uuid not null references public.patients(id) on delete cascade,
  appointment_id     uuid          references public.appointments(id) on delete set null,
  doctor_id          uuid not null references public.doctors(id) on delete restrict,

  visit_date         date not null,
  chief_complaint    text not null,
  symptoms           text,
  assessment         text,
  diagnosis          text,
  treatment_plan     text,
  doctor_notes       text,

  follow_up_required boolean not null default false,
  follow_up_date     date,

  status             text not null default 'draft'
                       check (status in ('draft', 'final', 'amended'))
);

comment on table public.medical_records is 'Electronic medical records — core clinical documentation';

-- ============================================================
-- PRESCRIPTIONS TABLE
-- ============================================================
create table if not exists public.prescriptions (
  id                uuid primary key default uuid_generate_v4(),
  created_at        timestamptz not null default now(),

  medical_record_id uuid not null references public.medical_records(id) on delete cascade,
  medication_name   text not null,
  dosage            text not null,
  frequency         text not null,
  duration          text not null,
  instructions      text
);

comment on table public.prescriptions is 'Medication prescriptions linked to medical records';

-- ============================================================
-- UPDATED_AT TRIGGER FOR MEDICAL RECORDS
-- ============================================================
create or replace trigger medical_records_updated_at
  before update on public.medical_records
  for each row execute function public.set_updated_at();

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_medical_records_patient
  on public.medical_records(patient_id);

create index if not exists idx_medical_records_doctor
  on public.medical_records(doctor_id);

create index if not exists idx_medical_records_appointment
  on public.medical_records(appointment_id);

create index if not exists idx_medical_records_visit_date
  on public.medical_records(visit_date desc);

create index if not exists idx_medical_records_status
  on public.medical_records(status);

create index if not exists idx_prescriptions_record
  on public.prescriptions(medical_record_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- Phase 4: permissive policies (no auth yet)
-- ============================================================
alter table public.medical_records  enable row level security;
alter table public.prescriptions    enable row level security;

create policy "medical_records_phase4_all"
  on public.medical_records
  for all to anon, authenticated
  using (true) with check (true);

create policy "prescriptions_phase4_all"
  on public.prescriptions
  for all to anon, authenticated
  using (true) with check (true);
