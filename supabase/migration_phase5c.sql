-- ─── Phase 5c: Service snapshot on appointments ──────────────────────────────
-- Stores service data atomically on the appointment record.
-- Eliminates dependency on the appointment_services junction table for billing.

alter table public.appointments
  add column if not exists service_id    uuid        references public.services(id) on delete set null,
  add column if not exists service_name  text,
  add column if not exists service_price numeric(10,2);

create index if not exists idx_appointments_service_id on public.appointments(service_id);
