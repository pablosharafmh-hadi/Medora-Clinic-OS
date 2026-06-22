-- ─── Phase 7: Notifications & Automation Center ─────────────────────────────

-- ─── Table ───────────────────────────────────────────────────────────────────

create table if not exists public.notifications (
  id            uuid        primary key default gen_random_uuid(),
  created_at    timestamptz not null    default now(),
  updated_at    timestamptz not null    default now(),
  title         text        not null,
  body          text,
  category      text        not null    check (category in ('patient', 'appointment', 'billing', 'staff', 'reminder', 'alert')),
  type          text        not null,
  priority      text        not null    default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status        text        not null    default 'unread' check (status in ('unread', 'read', 'dismissed')),
  related_id    uuid,
  related_type  text,
  role_target   text        not null    default 'all',
  metadata      jsonb       not null    default '{}',
  read_at       timestamptz,
  expires_at    timestamptz
);

-- Enable Realtime
alter table public.notifications replica identity full;

-- Indexes
create index if not exists idx_notifications_status   on public.notifications(status);
create index if not exists idx_notifications_category on public.notifications(category);
create index if not exists idx_notifications_created  on public.notifications(created_at desc);
create index if not exists idx_notifications_related  on public.notifications(related_id) where related_id is not null;

-- RLS
alter table public.notifications enable row level security;

create policy "notifications_select_all" on public.notifications for select using (true);
create policy "notifications_insert_all" on public.notifications for insert with check (true);
create policy "notifications_update_all" on public.notifications for update using (true) with check (true);
create policy "notifications_delete_all" on public.notifications for delete using (true);


-- ─── Trigger functions ────────────────────────────────────────────────────────

-- Patient created
create or replace function public.trg_notify_patient_created()
returns trigger language plpgsql security definer as $$
begin
  insert into public.notifications (title, body, category, type, priority, related_id, related_type, role_target, metadata)
  values (
    'New patient registered',
    NEW.first_name || ' ' || NEW.last_name || ' has been added to the patient registry.',
    'patient', 'patient_created', 'low',
    NEW.id, 'patient', 'all',
    jsonb_build_object('patient_name', NEW.first_name || ' ' || NEW.last_name)
  );
  return NEW;
end;
$$;

-- Patient updated (name or status change only)
create or replace function public.trg_notify_patient_updated()
returns trigger language plpgsql security definer as $$
begin
  if OLD.first_name = NEW.first_name
     and OLD.last_name = NEW.last_name
     and OLD.status = NEW.status then
    return NEW;
  end if;

  insert into public.notifications (title, body, category, type, priority, related_id, related_type, role_target, metadata)
  values (
    'Patient record updated',
    NEW.first_name || ' ' || NEW.last_name || '''s profile has been updated.',
    'patient', 'patient_updated', 'low',
    NEW.id, 'patient', 'all',
    jsonb_build_object('patient_name', NEW.first_name || ' ' || NEW.last_name, 'old_status', OLD.status, 'new_status', NEW.status)
  );
  return NEW;
end;
$$;

-- Doctor added
create or replace function public.trg_notify_doctor_added()
returns trigger language plpgsql security definer as $$
begin
  insert into public.notifications (title, body, category, type, priority, related_id, related_type, role_target, metadata)
  values (
    'New doctor onboarded',
    'Dr. ' || NEW.first_name || ' ' || NEW.last_name || ' (' || NEW.specialty || ') has been added.',
    'staff', 'doctor_added', 'normal',
    NEW.id, 'doctor', 'all',
    jsonb_build_object('doctor_name', 'Dr. ' || NEW.first_name || ' ' || NEW.last_name, 'specialty', NEW.specialty)
  );
  return NEW;
end;
$$;

-- Appointment created
create or replace function public.trg_notify_appointment_created()
returns trigger language plpgsql security definer as $$
declare
  v_patient_name text;
  v_doctor_name  text;
begin
  select first_name || ' ' || last_name into v_patient_name from public.patients where id = NEW.patient_id;
  select 'Dr. ' || first_name || ' ' || last_name into v_doctor_name from public.doctors where id = NEW.doctor_id;

  insert into public.notifications (title, body, category, type, priority, related_id, related_type, role_target, metadata)
  values (
    'Appointment scheduled',
    coalesce(v_patient_name, 'A patient') || ' booked an appointment with ' || coalesce(v_doctor_name, 'a doctor') || '.',
    'appointment', 'appointment_created', 'low',
    NEW.id, 'appointment', 'receptionist',
    jsonb_build_object('patient_id', NEW.patient_id, 'doctor_id', NEW.doctor_id, 'scheduled_at', NEW.scheduled_at)
  );
  return NEW;
end;
$$;

-- Appointment changed (rescheduled or status changed)
create or replace function public.trg_notify_appointment_changed()
returns trigger language plpgsql security definer as $$
declare
  v_patient_name text;
begin
  select first_name || ' ' || last_name into v_patient_name from public.patients where id = NEW.patient_id;

  -- Status change
  if OLD.status <> NEW.status then
    if NEW.status = 'cancelled' then
      insert into public.notifications (title, body, category, type, priority, related_id, related_type, role_target, metadata)
      values (
        'Appointment cancelled',
        coalesce(v_patient_name, 'A patient') || '''s appointment has been cancelled.',
        'appointment', 'appointment_cancelled', 'normal',
        NEW.id, 'appointment', 'all',
        jsonb_build_object('patient_id', NEW.patient_id, 'scheduled_at', NEW.scheduled_at)
      );
    elsif NEW.status = 'completed' then
      insert into public.notifications (title, body, category, type, priority, related_id, related_type, role_target, metadata)
      values (
        'Appointment completed',
        coalesce(v_patient_name, 'A patient') || '''s visit has been completed.',
        'appointment', 'appointment_completed', 'low',
        NEW.id, 'appointment', 'all',
        jsonb_build_object('patient_id', NEW.patient_id)
      );
    elsif NEW.status = 'no_show' then
      insert into public.notifications (title, body, category, type, priority, related_id, related_type, role_target, metadata)
      values (
        'Patient no-show',
        coalesce(v_patient_name, 'A patient') || ' did not attend their scheduled appointment.',
        'appointment', 'appointment_no_show', 'high',
        NEW.id, 'appointment', 'receptionist',
        jsonb_build_object('patient_id', NEW.patient_id, 'scheduled_at', OLD.scheduled_at)
      );
    end if;
  end if;

  -- Rescheduled (time changed, not cancelled/completed)
  if OLD.scheduled_at <> NEW.scheduled_at
     and NEW.status not in ('cancelled', 'completed', 'no_show') then
    insert into public.notifications (title, body, category, type, priority, related_id, related_type, role_target, metadata)
    values (
      'Appointment rescheduled',
      coalesce(v_patient_name, 'An appointment') || '''s appointment time has been changed.',
      'appointment', 'appointment_rescheduled', 'normal',
      NEW.id, 'appointment', 'all',
      jsonb_build_object('patient_id', NEW.patient_id, 'old_time', OLD.scheduled_at, 'new_time', NEW.scheduled_at)
    );
  end if;

  return NEW;
end;
$$;

-- Invoice generated
create or replace function public.trg_notify_invoice_created()
returns trigger language plpgsql security definer as $$
declare
  v_patient_name text;
begin
  select first_name || ' ' || last_name into v_patient_name from public.patients where id = NEW.patient_id;

  insert into public.notifications (title, body, category, type, priority, related_id, related_type, role_target, metadata)
  values (
    'Invoice generated',
    'An invoice of $' || to_char(NEW.total_amount, 'FM999999990.00') || ' has been created for ' || coalesce(v_patient_name, 'a patient') || '.',
    'billing', 'invoice_generated', 'low',
    NEW.id, 'invoice', 'manager',
    jsonb_build_object('patient_id', NEW.patient_id, 'amount', NEW.total_amount, 'invoice_number', NEW.invoice_number)
  );
  return NEW;
end;
$$;

-- Invoice status changed to overdue
create or replace function public.trg_notify_invoice_overdue()
returns trigger language plpgsql security definer as $$
declare
  v_patient_name text;
begin
  if OLD.status = NEW.status then return NEW; end if;
  if NEW.status <> 'overdue' then return NEW; end if;

  select first_name || ' ' || last_name into v_patient_name from public.patients where id = NEW.patient_id;

  insert into public.notifications (title, body, category, type, priority, related_id, related_type, role_target, metadata)
  values (
    'Invoice overdue',
    'Invoice for ' || coalesce(v_patient_name, 'a patient') || ' is overdue. Balance due: $' || to_char(NEW.balance_due, 'FM999999990.00'),
    'billing', 'overdue_invoice_alert', 'urgent',
    NEW.id, 'invoice', 'manager',
    jsonb_build_object('patient_id', NEW.patient_id, 'balance_due', NEW.balance_due, 'due_date', NEW.due_date)
  );
  return NEW;
end;
$$;

-- Payment recorded
create or replace function public.trg_notify_payment_recorded()
returns trigger language plpgsql security definer as $$
declare
  v_patient_name text;
begin
  select first_name || ' ' || last_name into v_patient_name from public.patients where id = NEW.patient_id;

  insert into public.notifications (title, body, category, type, priority, related_id, related_type, role_target, metadata)
  values (
    'Payment received',
    '$' || to_char(NEW.amount, 'FM999999990.00') || ' payment recorded for ' || coalesce(v_patient_name, 'a patient') || '.',
    'billing', 'payment_recorded', 'normal',
    NEW.invoice_id, 'invoice', 'manager',
    jsonb_build_object('patient_id', NEW.patient_id, 'amount', NEW.amount, 'payment_method', NEW.payment_method)
  );
  return NEW;
end;
$$;

-- Staff member added
create or replace function public.trg_notify_staff_added()
returns trigger language plpgsql security definer as $$
begin
  insert into public.notifications (title, body, category, type, priority, related_id, related_type, role_target, metadata)
  values (
    'Staff member added',
    NEW.first_name || ' ' || NEW.last_name || ' has been added as ' || initcap(NEW.role) || '.',
    'staff', 'staff_added', 'low',
    NEW.id, 'staff', 'manager',
    jsonb_build_object('staff_name', NEW.first_name || ' ' || NEW.last_name, 'role', NEW.role)
  );
  return NEW;
end;
$$;

-- Follow-up reminder from medical records
create or replace function public.trg_notify_follow_up_required()
returns trigger language plpgsql security definer as $$
declare
  v_patient_name text;
begin
  if NEW.follow_up_required = false then return NEW; end if;

  select first_name || ' ' || last_name into v_patient_name from public.patients where id = NEW.patient_id;

  insert into public.notifications (
    title, body, category, type, priority,
    related_id, related_type, role_target, metadata, expires_at
  )
  values (
    'Follow-up required',
    coalesce(v_patient_name, 'A patient') || ' requires a follow-up visit' ||
      case when NEW.follow_up_date is not null then ' on ' || to_char(NEW.follow_up_date::date, 'Mon DD, YYYY') else '' end || '.',
    'reminder', 'follow_up_reminder', 'high',
    NEW.patient_id, 'patient', 'doctor',
    jsonb_build_object(
      'patient_id', NEW.patient_id,
      'medical_record_id', NEW.id,
      'follow_up_date', NEW.follow_up_date
    ),
    case when NEW.follow_up_date is not null
         then (NEW.follow_up_date::timestamptz + interval '1 day')
         else null end
  );
  return NEW;
end;
$$;


-- ─── Triggers ─────────────────────────────────────────────────────────────────

drop trigger if exists notify_patient_created   on public.patients;
drop trigger if exists notify_patient_updated   on public.patients;
drop trigger if exists notify_doctor_added      on public.doctors;
drop trigger if exists notify_appointment_created  on public.appointments;
drop trigger if exists notify_appointment_changed  on public.appointments;
drop trigger if exists notify_invoice_created   on public.invoices;
drop trigger if exists notify_invoice_overdue   on public.invoices;
drop trigger if exists notify_payment_recorded  on public.payments;
drop trigger if exists notify_staff_added       on public.staff;
drop trigger if exists notify_follow_up_required on public.medical_records;

create trigger notify_patient_created
  after insert on public.patients
  for each row execute function public.trg_notify_patient_created();

create trigger notify_patient_updated
  after update on public.patients
  for each row execute function public.trg_notify_patient_updated();

create trigger notify_doctor_added
  after insert on public.doctors
  for each row execute function public.trg_notify_doctor_added();

create trigger notify_appointment_created
  after insert on public.appointments
  for each row execute function public.trg_notify_appointment_created();

create trigger notify_appointment_changed
  after update on public.appointments
  for each row execute function public.trg_notify_appointment_changed();

create trigger notify_invoice_created
  after insert on public.invoices
  for each row execute function public.trg_notify_invoice_created();

create trigger notify_invoice_overdue
  after update on public.invoices
  for each row execute function public.trg_notify_invoice_overdue();

create trigger notify_payment_recorded
  after insert on public.payments
  for each row execute function public.trg_notify_payment_recorded();

create trigger notify_staff_added
  after insert on public.staff
  for each row execute function public.trg_notify_staff_added();

create trigger notify_follow_up_required
  after insert on public.medical_records
  for each row execute function public.trg_notify_follow_up_required();
