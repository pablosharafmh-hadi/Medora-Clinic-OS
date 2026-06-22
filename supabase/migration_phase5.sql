-- ============================================================
-- MEDORA CLINIC OS — PHASE 5 MIGRATION
-- Billing & Financial Operations
-- Run in Supabase SQL Editor AFTER Phase 1, 2, 3, and 4
-- ============================================================

-- ============================================================
-- INVOICE NUMBER SEQUENCE
-- ============================================================
create sequence if not exists public.invoice_number_seq start 1;

-- ============================================================
-- SERVICES CATALOG
-- ============================================================
create table if not exists public.services (
  id           uuid        primary key default uuid_generate_v4(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  service_name text        not null,
  description  text,
  price        numeric(10,2) not null default 0 check (price >= 0),
  status       text        not null default 'active' check (status in ('active', 'inactive'))
);

-- ============================================================
-- INVOICES
-- ============================================================
create table if not exists public.invoices (
  id                 uuid        primary key default uuid_generate_v4(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  invoice_number     text        unique,

  patient_id         uuid        not null references public.patients(id) on delete restrict,
  appointment_id     uuid                 references public.appointments(id) on delete set null,
  medical_record_id  uuid                 references public.medical_records(id) on delete set null,

  issue_date         date        not null default current_date,
  due_date           date,

  subtotal           numeric(10,2) not null default 0,
  tax_rate           numeric(5,2)  not null default 0,
  tax_amount         numeric(10,2) not null default 0,
  discount_amount    numeric(10,2) not null default 0,
  total_amount       numeric(10,2) not null default 0,
  amount_paid        numeric(10,2) not null default 0,
  balance_due        numeric(10,2) not null default 0,

  status             text        not null default 'draft'
                                 check (status in ('draft','pending','paid','partially_paid','overdue','cancelled','refunded')),

  notes              text
);

-- ============================================================
-- INVOICE ITEMS
-- ============================================================
create table if not exists public.invoice_items (
  id           uuid        primary key default uuid_generate_v4(),
  created_at   timestamptz not null default now(),

  invoice_id   uuid        not null references public.invoices(id) on delete cascade,
  service_id   uuid                 references public.services(id) on delete set null,

  description  text        not null,
  quantity     integer     not null default 1 check (quantity > 0),
  unit_price   numeric(10,2) not null default 0,
  total_price  numeric(10,2) not null default 0
);

-- ============================================================
-- PAYMENTS
-- ============================================================
create table if not exists public.payments (
  id               uuid        primary key default uuid_generate_v4(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  invoice_id       uuid        not null references public.invoices(id) on delete cascade,
  patient_id       uuid        not null references public.patients(id) on delete restrict,

  payment_date     date        not null default current_date,
  amount           numeric(10,2) not null check (amount > 0),

  payment_method   text        not null default 'cash'
                               check (payment_method in ('cash','credit_card','bank_transfer','insurance','other')),

  reference_number text,
  notes            text,
  status           text        not null default 'completed'
                               check (status in ('completed','pending','failed','refunded'))
);

-- ============================================================
-- FINANCIAL TRANSACTIONS (AUDIT TRAIL)
-- ============================================================
create table if not exists public.financial_transactions (
  id           uuid        primary key default uuid_generate_v4(),
  created_at   timestamptz not null default now(),

  type         text        not null
               check (type in ('invoice_created','invoice_updated','invoice_cancelled',
                               'payment_recorded','refund_issued','adjustment')),

  invoice_id   uuid                 references public.invoices(id) on delete set null,
  payment_id   uuid                 references public.payments(id) on delete set null,
  patient_id   uuid                 references public.patients(id) on delete set null,

  amount       numeric(10,2),
  description  text        not null,
  metadata     jsonb       not null default '{}'::jsonb
);

-- ============================================================
-- INVOICE NUMBER AUTO-GENERATION TRIGGER
-- ============================================================
create or replace function public.set_invoice_number()
returns trigger language plpgsql as $$
begin
  if new.invoice_number is null then
    new.invoice_number := 'INV-' || lpad(nextval('public.invoice_number_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

create trigger trg_set_invoice_number
  before insert on public.invoices
  for each row execute function public.set_invoice_number();

-- ============================================================
-- UPDATED_AT TRIGGERS
-- (relies on set_updated_at() created in earlier migration)
-- ============================================================
create trigger trg_services_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

create trigger trg_invoices_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

create trigger trg_payments_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_invoices_patient_id   on public.invoices(patient_id);
create index if not exists idx_invoices_status       on public.invoices(status);
create index if not exists idx_invoices_issue_date   on public.invoices(issue_date desc);
create index if not exists idx_invoice_items_inv_id  on public.invoice_items(invoice_id);
create index if not exists idx_payments_invoice_id   on public.payments(invoice_id);
create index if not exists idx_payments_patient_id   on public.payments(patient_id);
create index if not exists idx_payments_date         on public.payments(payment_date desc);
create index if not exists idx_ft_invoice_id         on public.financial_transactions(invoice_id);
create index if not exists idx_ft_patient_id         on public.financial_transactions(patient_id);
create index if not exists idx_ft_created_at         on public.financial_transactions(created_at desc);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.services               enable row level security;
alter table public.invoices               enable row level security;
alter table public.invoice_items          enable row level security;
alter table public.payments               enable row level security;
alter table public.financial_transactions enable row level security;

create policy "services_phase5_all" on public.services
  for all to anon, authenticated using (true) with check (true);

create policy "invoices_phase5_all" on public.invoices
  for all to anon, authenticated using (true) with check (true);

create policy "invoice_items_phase5_all" on public.invoice_items
  for all to anon, authenticated using (true) with check (true);

create policy "payments_phase5_all" on public.payments
  for all to anon, authenticated using (true) with check (true);

create policy "financial_transactions_phase5_all" on public.financial_transactions
  for all to anon, authenticated using (true) with check (true);

-- ============================================================
-- SEED: SAMPLE SERVICES CATALOG
-- ============================================================
insert into public.services (service_name, description, price, status) values
  ('General Consultation',  'Standard outpatient consultation with a physician',  50.00,  'active'),
  ('Follow-Up Visit',       'Scheduled follow-up after initial consultation',      35.00,  'active'),
  ('Blood Test (CBC)',       'Complete blood count laboratory panel',               25.00,  'active'),
  ('X-Ray (Single View)',   'Standard radiograph, single view',                    80.00,  'active'),
  ('ECG / EKG',             'Electrocardiogram recording and interpretation',       60.00,  'active'),
  ('Dental Cleaning',       'Professional dental prophylaxis and cleaning',         90.00,  'active'),
  ('Vaccination',           'Single vaccine administration and documentation',      40.00,  'active'),
  ('Specialist Referral',   'Referral letter and coordination with specialist',     20.00,  'active')
on conflict do nothing;
