-- ============================================================
-- MEDORA CLINIC OS — PHASE 1 DATABASE SCHEMA
-- Project: dhyvrxbxfvltgqnzcgnx
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PATIENTS
-- ============================================================
create table if not exists public.patients (
  id            uuid primary key default uuid_generate_v4(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  first_name    text not null,
  last_name     text not null,
  date_of_birth date not null,
  gender        text not null check (gender in ('male', 'female', 'other')),

  phone         text not null,
  email         text,
  address       text,
  blood_type    text check (blood_type in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),

  status        text not null default 'active'
                  check (status in ('active', 'inactive', 'deceased'))
);

comment on table public.patients is 'Core patient registry';

-- ============================================================
-- DOCTORS
-- ============================================================
create table if not exists public.doctors (
  id             uuid primary key default uuid_generate_v4(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  first_name     text not null,
  last_name      text not null,
  specialty      text not null,

  phone          text not null,
  email          text not null unique,
  license_number text not null unique,

  status         text not null default 'active'
                   check (status in ('active', 'inactive', 'on_leave'))
);

comment on table public.doctors is 'Registered medical doctors and specialists';

-- ============================================================
-- APPOINTMENTS
-- ============================================================
create table if not exists public.appointments (
  id                uuid primary key default uuid_generate_v4(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  patient_id        uuid not null references public.patients(id) on delete cascade,
  doctor_id         uuid not null references public.doctors(id) on delete restrict,

  scheduled_at      timestamptz not null,
  duration_minutes  integer not null default 30 check (duration_minutes > 0),

  type              text not null default 'consultation'
                      check (type in ('consultation', 'follow_up', 'procedure', 'emergency')),

  status            text not null default 'scheduled'
                      check (status in ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')),

  notes             text
);

comment on table public.appointments is 'Patient–doctor appointment schedule';

-- ============================================================
-- STAFF
-- ============================================================
create table if not exists public.staff (
  id           uuid primary key default uuid_generate_v4(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  first_name   text not null,
  last_name    text not null,

  role         text not null
                 check (role in ('admin', 'manager', 'doctor', 'receptionist', 'nurse')),

  department   text,
  phone        text not null,
  email        text not null unique,
  employee_id  text not null unique,

  status       text not null default 'active'
                 check (status in ('active', 'inactive', 'on_leave'))
);

comment on table public.staff is 'All clinic personnel with role assignments';

-- ============================================================
-- FINANCE ENTRIES
-- ============================================================
create table if not exists public.finance_entries (
  id           uuid primary key default uuid_generate_v4(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  type         text not null check (type in ('income', 'expense')),
  category     text not null,
  amount       numeric(12, 2) not null check (amount >= 0),
  currency     text not null default 'USD',

  description  text,
  reference_id text,
  date         date not null,

  status       text not null default 'completed'
                 check (status in ('pending', 'completed', 'cancelled', 'refunded'))
);

comment on table public.finance_entries is 'Financial transactions: income and expenses';

-- ============================================================
-- INDEXES
-- ============================================================

-- Patients
create index if not exists idx_patients_status      on public.patients(status);
create index if not exists idx_patients_last_name   on public.patients(last_name);

-- Doctors
create index if not exists idx_doctors_status       on public.doctors(status);
create index if not exists idx_doctors_specialty    on public.doctors(specialty);

-- Appointments
create index if not exists idx_appts_patient        on public.appointments(patient_id);
create index if not exists idx_appts_doctor         on public.appointments(doctor_id);
create index if not exists idx_appts_scheduled_at   on public.appointments(scheduled_at);
create index if not exists idx_appts_status         on public.appointments(status);

-- Finance
create index if not exists idx_finance_type         on public.finance_entries(type);
create index if not exists idx_finance_date         on public.finance_entries(date);
create index if not exists idx_finance_status       on public.finance_entries(status);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger patients_updated_at
  before update on public.patients
  for each row execute function public.set_updated_at();

create or replace trigger doctors_updated_at
  before update on public.doctors
  for each row execute function public.set_updated_at();

create or replace trigger appointments_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

create or replace trigger staff_updated_at
  before update on public.staff
  for each row execute function public.set_updated_at();

create or replace trigger finance_updated_at
  before update on public.finance_entries
  for each row execute function public.set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (scaffold — policies to be added Phase 2)
-- ============================================================

alter table public.patients        enable row level security;
alter table public.doctors         enable row level security;
alter table public.appointments    enable row level security;
alter table public.staff           enable row level security;
alter table public.finance_entries enable row level security;
