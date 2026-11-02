/**
 * Hand-written row types matching supabase/migrations/0001_init.sql.
 *
 * If you change the SQL schema, update the matching type here — TypeScript
 * will then point at every place in the app that needs adjusting.
 */

export type Role = "admin" | "tenant" | "member";

export type ProfileRow = {
  id: string;
  contact_id: string | null;
  full_name: string | null;
  email: string | null;
  role: Role;
  /** When the welcome email went out. Null means it hasn't. */
  welcomed_at: string | null;
  created_at: string;
};

export type RoomRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  capacity: number | null;
  hourly_rate_cents: number;
  half_day_rate_cents: number | null;
  full_day_rate_cents: number | null;
  min_hours: number;
  buffer_minutes: number;
  is_bookable: boolean;
  requires_approval: boolean;
  image_url: string | null;
  sort_order: number;
};

export type EventRow = {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  location: string | null;
  is_at_building: boolean;
  room_id: string | null;
  host_name: string | null;
  contact_email: string | null;
  category: string | null;
  image_url: string | null;
  external_url: string | null;
  status: "draft" | "published" | "cancelled";
};

export type ContactRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  organisation: string | null;
  tags: string[];
  address: string | null;
  notes: string | null;
  created_at: string;
};

export type UnitRow = {
  id: string;
  name: string;
  kind: "office" | "suite" | "retail" | "storage" | "other";
  floor: string | null;
  description: string | null;
  monthly_rate_cents: number;
  is_active: boolean;
  sort_order: number;
};

export type LeaseRow = {
  id: string;
  unit_id: string;
  contact_id: string;
  start_date: string;
  end_date: string | null;
  rent_cents: number;
  deposit_cents: number;
  due_day: number;
  status: "pending" | "active" | "ended";
  notes: string | null;
  /* Written down at move-in; all of it wanted at an awkward moment later. */
  emergency_name: string | null;
  emergency_phone: string | null;
  emergency_relationship: string | null;
  keys_issued: number | null;
  vehicle: string | null;
  parking_stall: string | null;
  other_occupants: string | null;
  from_waiting_list: string | null;
};

export type InvoiceState = "draft" | "outstanding" | "overdue" | "paid" | "void";

/** Shape of the `invoice_balances` view — invoice plus computed balance. */
export type InvoiceRow = {
  id: string;
  number: string | null;
  contact_id: string;
  lease_id: string | null;
  booking_id: string | null;
  appointment_id: string | null;
  kind: "rent" | "booking" | "counselling" | "deposit" | "other";
  description: string | null;
  period_start: string | null;
  period_end: string | null;
  issue_date: string;
  due_date: string;
  amount_cents: number;
  tax_cents: number;
  status: "draft" | "sent" | "paid" | "void";
  notes: string | null;
  /* From the view */
  paid_cents: number;
  balance_cents: number;
  state: InvoiceState;
  days_overdue: number;
};

export type PaymentRow = {
  id: string;
  invoice_id: string | null;
  contact_id: string;
  amount_cents: number;
  paid_at: string;
  method: "stripe" | "etransfer" | "cash" | "cheque" | "other";
  reference: string | null;
  notes: string | null;
};

export type BookingRow = {
  id: string;
  room_id: string;
  contact_id: string | null;
  booker_name: string;
  booker_email: string;
  booker_phone: string | null;
  title: string;
  purpose: string | null;
  starts_at: string;
  ends_at: string;
  attendees: number | null;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  total_cents: number;
  is_paid: boolean;
  is_public: boolean;
  admin_notes: string | null;
  created_at: string;
};

export type AppointmentRow = {
  id: string;
  contact_id: string | null;
  client_name: string;
  starts_at: string;
  ends_at: string;
  kind: "intake" | "session" | "follow_up" | "consult" | "other";
  location: string | null;
  rate_cents: number;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  invoice_id: string | null;
};

export type TaskRow = {
  id: string;
  title: string;
  notes: string | null;
  due_date: string | null;
  status: "open" | "doing" | "done";
  area: "general" | "rentals" | "bookings" | "finance" | "counselling";
  contact_id: string | null;
  created_at: string;
};

export type DonationRow = {
  id: string;
  donor_name: string | null;
  email: string | null;
  amount_cents: number;
  is_anonymous: boolean;
  message: string | null;
  stripe_session_id: string | null;
  received_at: string;
};

export type ExpenseRow = {
  id: string;
  incurred_on: string;
  vendor: string | null;
  category: string;
  description: string | null;
  amount_cents: number;
  tax_cents: number;
  payment_method: string | null;
  receipt_url: string | null;
  notes: string | null;
};

export type CounsellingRequestRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  message: string | null;
  preferred_times: string | null;
  status: "new" | "contacted" | "scheduled" | "declined" | "closed";
  created_at: string;
};

/* ---------------------------------------------------------------------------
   Classes, instructors, equipment, storage and memberships
   --------------------------------------------------------------------------- */

export type Tier = "full" | "reduced" | "subsidized";

export type InstructorRow = {
  id: string;
  contact_id: string | null;
  display_name: string;
  headline: string | null;
  bio: string | null;
  photo_url: string | null;
  standing: "new" | "earned";
  earned_at: string | null;
  guaranteed_pay_cents: number;
  split_percent: number | null;
  agreement_signed_on: string | null;
  waiver_signed_on: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

export type EquipmentRow = {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  session_rate_cents: number;
  is_active: boolean;
  created_at: string;
};

export type StorageRentalRow = {
  id: string;
  instructor_id: string;
  label: string;
  size: "shelf" | "locker" | "closet" | "corner" | "room";
  monthly_rate_cents: number;
  started_on: string;
  ended_on: string | null;
  notes: string | null;
  created_at: string;
};

export type ClassRow = {
  id: string;
  instructor_id: string | null;
  room_id: string | null;
  title: string;
  summary: string | null;
  description: string | null;
  session_minutes: number;
  capacity: number;
  full_price_cents: number;
  reduced_price_cents: number;
  subsidized_price_cents: number;
  subsidized_seat_cap: number;
  credit_cost: number;
  /** Landlord's eyes only — never sent to a public page. */
  materials_cost_cents: number;
  materials_note: string | null;
  min_headcount: number;
  status: "draft" | "open" | "full" | "finished" | "cancelled";
  is_public: boolean;
  created_at: string;
};

/** A class as the public sees it: no materials cost, no private notes. */
export type PublicClass = Omit<
  ClassRow,
  "materials_cost_cents" | "materials_note"
>;

export type ClassSessionRow = {
  id: string;
  class_id: string;
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "confirmed" | "cancelled" | "delivered";
  decided_at: string | null;
  cancel_reason: string | null;
  attendance_recorded_at: string | null;
  notes: string | null;
  created_at: string;
};

export type EnrolmentRow = {
  id: string;
  session_id: string;
  contact_id: string | null;
  attendee_name: string;
  attendee_email: string | null;
  tier: Tier;
  method: "cash" | "credit";
  credits_spent: number;
  paid_cents: number;
  subsidy_cents: number;
  attended: boolean | null;
  cancelled_at: string | null;
  created_at: string;
};

export type MembershipRow = {
  id: string;
  contact_id: string;
  plan: "individual" | "family";
  household_name: string | null;
  monthly_price_cents: number;
  credits_per_month: number;
  status: "active" | "paused" | "cancelled";
  started_on: string;
  cancelled_on: string | null;
  stripe_subscription_id: string | null;
  notes: string | null;
  created_at: string;
};

export type CreditLedgerRow = {
  id: string;
  membership_id: string;
  delta: number;
  reason: "monthly" | "purchase" | "spent" | "refund" | "expired" | "adjustment";
  session_id: string | null;
  expires_on: string | null;
  period: string | null;
  note: string | null;
  created_at: string;
};

export type InstructorStatementRow = {
  id: string;
  instructor_id: string;
  period: string;
  class_revenue_cents: number;
  instructor_share_cents: number;
  equipment_cents: number;
  storage_cents: number;
  guaranteed_cents: number;
  net_payout_cents: number;
  materials_cents: number;
  sessions_delivered: number;
  status: "draft" | "paid";
  paid_on: string | null;
  notes: string | null;
  created_at: string;
};

/** Editable in /admin/settings; defaults live in migration 0004. */
export type ClassSettings = {
  hub_split_percent: number;
  confirm_hours_before: number;
  earned_after_sessions: number;
  earned_min_average_attendance: number;
};

export type CreditSettings = {
  individual_price_cents: number;
  individual_credits: number;
  family_price_cents: number;
  family_credits: number;
  extra_credit_cents: number;
  dropin_cents: number;
  rollover_months: number;
  family_same_class_cap: number;
};

/* ---------------------------------------------------------------------------
   Grants and conferences
   --------------------------------------------------------------------------- */

export type OpportunityKind = "grant" | "conference";

export type OpportunityStatus =
  | "new"
  | "interested"
  | "not_interested"
  | "applied"
  | "awarded"
  | "rejected";

export type OpportunityRow = {
  id: string;
  kind: OpportunityKind;
  title: string;
  organisation: string | null;
  summary: string | null;
  url: string | null;
  why_relevant: string | null;

  amount_min_cents: number | null;
  amount_max_cents: number | null;
  deadline: string | null;
  eligibility: string | null;
  covers_travel: boolean;

  starts_on: string | null;
  ends_on: string | null;
  location: string | null;
  is_online: boolean;
  cost_cents: number | null;
  cost_note: string | null;

  status: OpportunityStatus;
  archived_at: string | null;
  notes: string | null;

  /** Who to talk to at the funder. */
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;

  /** Share of the project they pay. 50 means we find the other half. */
  match_percent: number | null;
  match_note: string | null;

  /** The funder's own application form, usually a PDF. */
  application_url: string | null;
  opens_on: string | null;

  outreach_to: string | null;
  outreach_subject: string | null;
  outreach_draft: string | null;
  outreach_sent_at: string | null;

  digest_sent_at: string | null;

  /** Her own estimate of the chance of getting it, 0-100. */
  probability: number | null;
  owner: string | null;
  next_action: string | null;
  /** For rolling intakes, where a sentence is more honest than a date. */
  deadline_note: string | null;

  source: "search" | "manual";
  confidence: "high" | "medium" | "low" | null;
  verified_at: string | null;
  found_at: string;
  fingerprint: string;
  created_at: string;
};

export type OpportunityStepRow = {
  id: string;
  opportunity_id: string;
  position: number;
  title: string;
  detail: string | null;
  done_at: string | null;
  created_at: string;
};

export type ResearchRunRow = {
  id: string;
  kind: OpportunityKind;
  started_at: string;
  finished_at: string | null;
  found: number;
  added: number;
  status: "running" | "ok" | "failed" | "skipped";
  message: string | null;
};

/** Editable in /admin/settings; defaults live in migration 0006. */
export type ResearchSettings = {
  enabled: boolean;
  profile: string;
  grant_notes: string;
  conference_notes: string;
  max_results: number;
};

/* ---------------------------------------------------------------------------
   The project plan
   --------------------------------------------------------------------------- */

export type GateStatus = "not_started" | "in_progress" | "passed";

export type ProjectGateRow = {
  id: string;
  position: number;
  decision: string;
  conditions: string;
  owner: string | null;
  evidence: string | null;
  target_on: string | null;
  status: GateStatus;
  risk_if_skipped: string | null;
  passed_on: string | null;
  notes: string | null;
  created_at: string;
};

export type TaskPriority = "critical" | "high" | "medium" | "low";
export type ProjectTaskStatus = "todo" | "doing" | "blocked" | "done";

export type ProjectTaskRow = {
  id: string;
  ref: string | null;
  phase: string;
  workstream: string | null;
  title: string;
  why: string | null;
  owner: string | null;
  priority: TaskPriority;
  status: ProjectTaskStatus;
  starts_on: string | null;
  due_on: string | null;
  dependency: string | null;
  next_action: string | null;
  notes: string | null;
  done_at: string | null;
  created_at: string;
};

/* ---------------------------------------------------------------------------
   Maintenance
   --------------------------------------------------------------------------- */

export type Urgency2 = "whenever" | "normal" | "urgent";

export type MaintenanceStatus = "new" | "seen" | "doing" | "fixed" | "declined";

export type MaintenanceRequestRow = {
  id: string;
  unit_id: string | null;
  lease_id: string | null;
  contact_id: string | null;
  reported_by: string;
  title: string;
  detail: string | null;
  urgency: Urgency2;
  photo_path: string | null;
  status: MaintenanceStatus;
  fixed_at: string | null;
  fixed_by: "renter" | "tausha" | null;
  cost_cents: number | null;
  receipt_path: string | null;
  cost_note: string | null;
  expense_id: string | null;
  /** Private to Tausha — never shown to the renter. */
  admin_notes: string | null;
  /** Shown to the renter. */
  reply_to_renter: string | null;
  created_at: string;
  updated_at: string;
};

/* --- Ending a tenancy ----------------------------------------------------- */

export type MoveOutStatus = "open" | "tenant_done" | "inspected" | "settled";

export type MoveOutRow = {
  id: string;
  lease_id: string;
  unit_id: string | null;
  contact_id: string | null;
  leaving_on: string;
  forwarding_address: string | null;
  forwarding_email: string | null;
  status: MoveOutStatus;
  inspected_on: string | null;
  inspection_notes: string | null;
  tenant_signature_event: string | null;
  created_at: string;
  updated_at: string;
};

export type MoveOutItemRow = {
  id: string;
  move_out_id: string;
  position: number;
  area: string;
  title: string;
  detail: string | null;
  done_by_tenant: boolean;
  tenant_note: string | null;
  /** Null until Tausha has looked at it. */
  checked_by_admin: boolean | null;
  admin_note: string | null;
  charge_cents: number | null;
  photo_path: string | null;
  created_at: string;
};

/** One movement of deposit money. Positive is in, negative is out. */
export type DepositEntryRow = {
  id: string;
  lease_id: string;
  move_out_id: string | null;
  amount_cents: number;
  kind: "held" | "interest" | "deduction" | "returned";
  reason: string;
  occurred_on: string;
  evidence_path: string | null;
  created_at: string;
};

/** An append-only record that somebody signed something. */
export type SignatureEventRow = {
  id: string;
  document_type: "lease" | "move_out" | "condition_report" | "policy" | "other";
  document_id: string | null;
  document_title: string;
  document_text: string;
  signed_by: string;
  signer_name: string;
  signer_email: string;
  signature_path: string | null;
  /** Drawn on their own device, or uploaded as a picture. */
  signature_source: "drawn" | "uploaded";
  signed_at: string;
  ip: string | null;
  user_agent: string | null;
  document_hash: string;
  prev_hash: string | null;
  record_hash: string;
  verify_code: string;
};

/* --- Looking after the building ------------------------------------------- */

export type ContractorRow = {
  id: string;
  name: string;
  trade: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  /** How it went last time, in her own words. */
  how_it_went: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type RecurringTaskRow = {
  id: string;
  title: string;
  detail: string | null;
  unit_id: string | null;
  area: string | null;
  every_months: number;
  last_done_on: string | null;
  next_due_on: string;
  contractor_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type WarrantyRow = {
  id: string;
  item: string;
  unit_id: string | null;
  supplier: string | null;
  supplier_phone: string | null;
  purchased_on: string | null;
  expires_on: string | null;
  cost_cents: number | null;
  document_path: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type WaitingListRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  looking_for: string | null;
  unit_kinds: string[];
  budget_cents: number | null;
  needed_from: string | null;
  notes: string | null;
  status: "waiting" | "offered" | "housed" | "gone";
  last_contacted_on: string | null;
  created_at: string;
  updated_at: string;
};
