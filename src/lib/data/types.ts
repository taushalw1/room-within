/**
 * Hand-written row types matching supabase/migrations/0001_init.sql.
 *
 * If you change the SQL schema, update the matching type here — TypeScript
 * will then point at every place in the app that needs adjusting.
 */

export type Role = "admin" | "tenant" | "member";

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
