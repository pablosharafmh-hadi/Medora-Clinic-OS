export type UserRole = "admin" | "manager" | "doctor" | "receptionist" | "nurse";

// ─── Patient ──────────────────────────────────────────────────────────────────

export type PatientStatus = "active" | "inactive" | "deceased";
export type Gender = "male" | "female" | "other";
export type BloodType = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";

export type Patient = {
  id: string;
  created_at: string;
  updated_at: string;
  patient_number: string | null;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: Gender;
  phone: string;
  email: string | null;
  address: string | null;
  blood_type: BloodType | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  allergies: string | null;
  notes: string | null;
  status: PatientStatus;
};

export type PatientInsert = Omit<Patient, "id" | "created_at" | "updated_at" | "patient_number">;
export type PatientUpdate = Partial<PatientInsert>;

export type PatientMetrics = {
  total: number;
  active: number;
  inactive: number;
  thisMonth: number;
};

export type TimelineEvent = {
  id: string;
  type: "created" | "updated" | "appointment" | "record" | "note";
  title: string;
  description: string;
  date: string;
};

// ─── Doctor ───────────────────────────────────────────────────────────────────

export type Doctor = {
  id: string;
  created_at: string;
  updated_at: string;
  first_name: string;
  last_name: string;
  specialty: string;
  phone: string;
  email: string;
  license_number: string;
  status: "active" | "inactive" | "on_leave";
};

// ─── Appointment ──────────────────────────────────────────────────────────────

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "checked_in"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";

export type AppointmentType =
  | "consultation"
  | "follow_up"
  | "procedure"
  | "check_up"
  | "emergency"
  | "custom";

export type Appointment = {
  id: string;
  created_at: string;
  updated_at: string;
  patient_id: string;
  doctor_id: string;
  scheduled_at: string;
  duration_minutes: number;
  type: AppointmentType;
  custom_type_label: string | null;
  status: AppointmentStatus;
  notes: string | null;
  service_id: string | null;
  service_name: string | null;
  service_price: number | null;
};

export type AppointmentWithRelations = Appointment & {
  patient: {
    first_name: string;
    last_name: string;
    patient_number: string | null;
  } | null;
  doctor: {
    first_name: string;
    last_name: string;
    specialty: string;
  } | null;
};

export type AppointmentInsert = Omit<Appointment, "id" | "created_at" | "updated_at">;
export type AppointmentUpdate = Partial<AppointmentInsert>;

export type AppointmentMetrics = {
  today: number;
  thisWeek: number;
  completed: number;
  cancelled: number;
  noShow: number;
};

// ─── Staff ────────────────────────────────────────────────────────────────────

export type Staff = {
  id: string;
  created_at: string;
  updated_at: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  department: string | null;
  phone: string;
  email: string;
  employee_id: string;
  salary: number | null;
  status: "active" | "inactive" | "on_leave";
};

export type StaffInsert = Omit<Staff, "id" | "created_at" | "updated_at">;
export type StaffUpdate = Partial<StaffInsert>;

/** Unified display row merging staff table rows and doctor records. */
export type StaffRow = {
  id: string;
  source: "staff" | "doctor";
  first_name: string;
  last_name: string;
  role: UserRole;
  department: string | null;
  phone: string;
  email: string;
  employee_id: string | null;
  salary: number | null;
  status: "active" | "inactive" | "on_leave";
};

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationCategory = "patient" | "appointment" | "billing" | "staff" | "reminder" | "alert";
export type NotificationStatus   = "unread" | "read" | "dismissed";
export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export type Notification = {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  body: string | null;
  category: NotificationCategory;
  type: string;
  priority: NotificationPriority;
  status: NotificationStatus;
  related_id: string | null;
  related_type: string | null;
  role_target: string;
  metadata: Record<string, unknown>;
  read_at: string | null;
  expires_at: string | null;
};

export type NotificationInsert = Omit<Notification, "id" | "created_at" | "updated_at" | "read_at">;
export type NotificationUpdate  = Partial<Pick<Notification, "status" | "read_at">>;

// ─── Finance ──────────────────────────────────────────────────────────────────

export type FinanceEntry = {
  id: string;
  created_at: string;
  updated_at: string;
  type: "income" | "expense";
  category: string;
  amount: number;
  currency: string;
  description: string | null;
  reference_id: string | null;
  date: string;
  status: "pending" | "completed" | "cancelled" | "refunded";
};

// ─── Medical Records ──────────────────────────────────────────────────────────

export type MedicalRecordStatus = "draft" | "final" | "amended";

export type MedicalRecord = {
  id: string;
  created_at: string;
  updated_at: string;
  patient_id: string;
  appointment_id: string | null;
  doctor_id: string;
  visit_date: string;
  chief_complaint: string;
  symptoms: string | null;
  assessment: string | null;
  diagnosis: string | null;
  treatment_plan: string | null;
  doctor_notes: string | null;
  follow_up_required: boolean;
  follow_up_date: string | null;
  status: MedicalRecordStatus;
};

export type MedicalRecordWithRelations = MedicalRecord & {
  patient: { first_name: string; last_name: string; patient_number: string | null } | null;
  doctor: { first_name: string; last_name: string; specialty: string } | null;
  appointment: { scheduled_at: string; type: string } | null;
  prescriptions: Prescription[];
};

export type MedicalRecordInsert = Omit<MedicalRecord, "id" | "created_at" | "updated_at">;
export type MedicalRecordUpdate = Partial<MedicalRecordInsert>;

export type MedicalRecordMetrics = {
  total: number;
  thisMonth: number;
  draft: number;
  final: number;
  withFollowUp: number;
};

// ─── Prescriptions ────────────────────────────────────────────────────────────

export type Prescription = {
  id: string;
  created_at: string;
  medical_record_id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string | null;
};

export type PrescriptionInsert = Omit<Prescription, "id" | "created_at">;
export type PrescriptionUpdate = Partial<Omit<PrescriptionInsert, "medical_record_id">>;

// ─── Services ────────────────────────────────────────────────────────────────

export type Service = {
  id: string;
  created_at: string;
  updated_at: string;
  service_name: string;
  category?: string | null;
  description: string | null;
  price: number;
  status: "active" | "inactive";
};

export type ServiceInsert = Omit<Service, "id" | "created_at" | "updated_at">;
export type ServiceUpdate = Partial<ServiceInsert>;

// ─── Appointment Services ─────────────────────────────────────────────────────

export type SelectedService = {
  service_id: string;
  service_name: string;
  quantity: number;
  unit_price: number;
};

export type AppointmentService = {
  id: string;
  appointment_id: string;
  service_id: string;
  quantity: number;
  unit_price: number;
  created_at: string;
  service: {
    service_name: string;
    category: string | null;
    description: string | null;
    price: number;
  } | null;
};

// ─── Invoices ────────────────────────────────────────────────────────────────

export type InvoiceStatus =
  | "draft"
  | "pending"
  | "paid"
  | "partially_paid"
  | "overdue"
  | "cancelled"
  | "refunded";

export type Invoice = {
  id: string;
  created_at: string;
  updated_at: string;
  invoice_number: string | null;
  patient_id: string;
  appointment_id: string | null;
  medical_record_id: string | null;
  issue_date: string;
  due_date: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  status: InvoiceStatus;
  notes: string | null;
};

export type InvoiceItem = {
  id: string;
  created_at: string;
  invoice_id: string;
  service_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
};

export type InvoiceWithRelations = Invoice & {
  patient: { first_name: string; last_name: string; patient_number: string | null } | null;
  invoice_items: InvoiceItem[];
  payments: Payment[];
};

export type InvoiceInsert = Omit<Invoice, "id" | "created_at" | "updated_at" | "invoice_number">;
export type InvoiceUpdate = Partial<Omit<InvoiceInsert, "patient_id">>;

export type InvoiceItemInsert = Omit<InvoiceItem, "id" | "created_at">;

// ─── Payments ────────────────────────────────────────────────────────────────

export type PaymentMethod = "cash" | "credit_card" | "bank_transfer" | "insurance" | "other";
export type PaymentStatus = "completed" | "pending" | "failed" | "refunded";

export type Payment = {
  id: string;
  created_at: string;
  updated_at: string;
  invoice_id: string;
  patient_id: string;
  payment_date: string;
  amount: number;
  payment_method: PaymentMethod;
  reference_number: string | null;
  notes: string | null;
  status: PaymentStatus;
};

export type PaymentInsert = Omit<Payment, "id" | "created_at" | "updated_at">;

// ─── Financial Transactions ──────────────────────────────────────────────────

export type FinancialTransactionType =
  | "invoice_created"
  | "invoice_updated"
  | "invoice_cancelled"
  | "payment_recorded"
  | "refund_issued"
  | "adjustment";

export type FinancialTransaction = {
  id: string;
  created_at: string;
  type: FinancialTransactionType;
  invoice_id: string | null;
  payment_id: string | null;
  patient_id: string | null;
  amount: number | null;
  description: string;
  metadata: Record<string, unknown>;
};

export type FinancialTransactionInsert = Omit<FinancialTransaction, "id" | "created_at">;

export type FinancialMetrics = {
  revenueToday: number;
  revenueThisWeek: number;
  revenueThisMonth: number;
  revenueThisYear: number;
  paidInvoicesCount: number;
  outstandingInvoicesCount: number;
  outstandingBalance: number;
  totalInvoicesCount: number;
};

// ─── Database schema (for reference) ─────────────────────────────────────────

export type Database = {
  public: {
    Tables: {
      patients: {
        Row: Patient;
        Insert: PatientInsert;
        Update: PatientUpdate;
      };
      doctors: {
        Row: Doctor;
        Insert: Omit<Doctor, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Doctor, "id" | "created_at">>;
      };
      appointments: {
        Row: Appointment;
        Insert: AppointmentInsert;
        Update: AppointmentUpdate;
      };
      staff: {
        Row: Staff;
        Insert: Omit<Staff, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Staff, "id" | "created_at">>;
      };
      finance_entries: {
        Row: FinanceEntry;
        Insert: Omit<FinanceEntry, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<FinanceEntry, "id" | "created_at">>;
      };
    };
  };
};
