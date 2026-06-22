-- ─── Phase 5b: Smart Billing & Appointment Services ─────────────────────────

-- Add category column to services
alter table public.services add column if not exists category text;

-- Seed categories on existing services
update public.services set category = 'Consultation'
  where lower(service_name) like '%consultation%' or lower(service_name) like '%follow%';

update public.services set category = 'Diagnostics'
  where lower(service_name) like '%blood%' or lower(service_name) like '%x-ray%'
     or lower(service_name) like '%ecg%' or lower(service_name) like '%scan%'
     or lower(service_name) like '%test%';

update public.services set category = 'Procedures'
  where lower(service_name) like '%procedure%' or lower(service_name) like '%surgery%'
     or lower(service_name) like '%cleaning%' or lower(service_name) like '%therapy%';

-- Default remaining services to 'General'
update public.services set category = 'General' where category is null;

-- ─── Appointment ↔ Services (many-to-many) ───────────────────────────────────

create table if not exists public.appointment_services (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  service_id     uuid not null references public.services(id) on delete restrict,
  quantity       integer not null default 1 check (quantity >= 1),
  unit_price     numeric(10,2) not null check (unit_price >= 0),
  created_at     timestamptz default now()
);

create index if not exists idx_appt_svcs_appointment_id on public.appointment_services(appointment_id);
create index if not exists idx_appt_svcs_service_id     on public.appointment_services(service_id);

alter table public.appointment_services enable row level security;

drop policy if exists "appt_svcs_all" on public.appointment_services;
create policy "appt_svcs_all" on public.appointment_services
  for all using (true) with check (true);
