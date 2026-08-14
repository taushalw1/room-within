import { startOfMonth, subMonths } from "date-fns";
import { getServerSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import {
  sampleAppointments,
  sampleBookings,
  sampleContacts,
  sampleDonationTotalCents,
  sampleExpenses,
  sampleInvoices,
  sampleLeases,
  sampleMonthlyTotals,
  sampleRequests,
  sampleTasks,
  sampleUnits,
} from "./sample-admin";
import { sampleRooms } from "./sample";
import type {
  AppointmentRow,
  BookingRow,
  ContactRow,
  CounsellingRequestRow,
  ExpenseRow,
  InvoiceRow,
  LeaseRow,
  TaskRow,
  UnitRow,
} from "./types";

/**
 * Admin read helpers. Every one returns sample data in demo mode so the whole
 * admin area can be explored before the database exists.
 *
 * These run as the signed-in user, so Postgres row-level security is still the
 * backstop — a non-admin calling these gets nothing back.
 */

export async function getContacts(): Promise<ContactRow[]> {
  if (isDemoMode) return sampleContacts;
  const supabase = await getServerSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("contacts")
    .select("*")
    .order("full_name");
  return (data as ContactRow[]) ?? [];
}

export async function getInvoices(): Promise<InvoiceRow[]> {
  if (isDemoMode) return sampleInvoices;
  const supabase = await getServerSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("invoice_balances")
    .select("*")
    .order("due_date", { ascending: false });
  return (data as InvoiceRow[]) ?? [];
}

export async function getUnits(): Promise<UnitRow[]> {
  if (isDemoMode) return sampleUnits;
  const supabase = await getServerSupabase();
  if (!supabase) return [];
  const { data } = await supabase.from("units").select("*").order("sort_order");
  return (data as UnitRow[]) ?? [];
}

export async function getLeases(): Promise<LeaseRow[]> {
  if (isDemoMode) return sampleLeases;
  const supabase = await getServerSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("leases")
    .select("*")
    .eq("status", "active");
  return (data as LeaseRow[]) ?? [];
}

export async function getBookings(): Promise<BookingRow[]> {
  if (isDemoMode) return sampleBookings;
  const supabase = await getServerSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("bookings")
    .select("*")
    .order("starts_at");
  return (data as BookingRow[]) ?? [];
}

export async function getExpenses(): Promise<ExpenseRow[]> {
  if (isDemoMode) return sampleExpenses;
  const supabase = await getServerSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("expenses")
    .select("*")
    .order("incurred_on", { ascending: false });
  return (data as ExpenseRow[]) ?? [];
}

export async function getAppointments(): Promise<AppointmentRow[]> {
  if (isDemoMode) return sampleAppointments;
  const supabase = await getServerSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("counselling_appointments")
    .select("*")
    .order("starts_at");
  return (data as AppointmentRow[]) ?? [];
}

export async function getTasks(): Promise<TaskRow[]> {
  if (isDemoMode) return sampleTasks;
  const supabase = await getServerSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("tasks")
    .select("*")
    .order("due_date", { nullsFirst: false });
  return (data as TaskRow[]) ?? [];
}

export async function getCounsellingRequests(): Promise<CounsellingRequestRow[]> {
  if (isDemoMode) return sampleRequests;
  const supabase = await getServerSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("counselling_requests")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as CounsellingRequestRow[]) ?? [];
}

/** Month-by-month income vs expenses for the last 12 months. */
export async function getMonthlyTotals() {
  if (isDemoMode) return sampleMonthlyTotals();

  const supabase = await getServerSupabase();
  if (!supabase) return [];

  const from = startOfMonth(subMonths(new Date(), 11)).toISOString();
  const [{ data: payments }, { data: expenses }] = await Promise.all([
    supabase.from("payments").select("amount_cents, paid_at").gte("paid_at", from),
    supabase.from("expenses").select("amount_cents, incurred_on").gte("incurred_on", from),
  ]);

  const buckets = new Map<string, { month: string; income: number; expenses: number }>();
  for (let i = 11; i >= 0; i--) {
    const m = startOfMonth(subMonths(new Date(), i));
    const key = `${m.getFullYear()}-${m.getMonth()}`;
    buckets.set(key, {
      month: m.toLocaleString("en-CA", { month: "short" }),
      income: 0,
      expenses: 0,
    });
  }

  for (const p of payments ?? []) {
    const d = new Date(p.paid_at as string);
    const b = buckets.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (b) b.income += (p.amount_cents as number) ?? 0;
  }
  for (const e of expenses ?? []) {
    const d = new Date(e.incurred_on as string);
    const b = buckets.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (b) b.expenses += (e.amount_cents as number) ?? 0;
  }

  return [...buckets.values()];
}

/** Everything the dashboard needs, in one call. */
export async function getDashboard() {
  const [invoices, bookings, appointments, tasks, requests, expenses, contacts, monthly] =
    await Promise.all([
      getInvoices(),
      getBookings(),
      getAppointments(),
      getTasks(),
      getCounsellingRequests(),
      getExpenses(),
      getContacts(),
      getMonthlyTotals(),
    ]);

  const now = new Date();
  const monthStart = startOfMonth(now);

  const overdue = invoices.filter((i) => i.state === "overdue");
  const outstanding = invoices.filter((i) => i.state === "outstanding");

  // Keyed off when the money actually arrived, not when the invoice was
  // raised — an invoice issued in June and paid in July is July's income.
  const collectedThisMonth = monthly.at(-1)?.income ?? 0;

  const expensesThisMonth = expenses
    .filter((e) => new Date(e.incurred_on) >= monthStart)
    .reduce((sum, e) => sum + e.amount_cents, 0);

  const upcomingBookings = bookings
    .filter((b) => new Date(b.starts_at) >= now && b.status !== "cancelled")
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  const pendingBookings = bookings.filter((b) => b.status === "pending");

  const upcomingAppointments = appointments
    .filter((a) => new Date(a.starts_at) >= now && a.status === "scheduled")
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  const openTasks = tasks.filter((t) => t.status !== "done");
  const newRequests = requests.filter((r) => r.status === "new");

  return {
    overdue,
    overdueCents: overdue.reduce((s, i) => s + i.balance_cents, 0),
    outstanding,
    outstandingCents: outstanding.reduce((s, i) => s + i.balance_cents, 0),
    collectedThisMonth,
    expensesThisMonth,
    upcomingBookings,
    pendingBookings,
    upcomingAppointments,
    openTasks,
    newRequests,
    contactCount: contacts.length,
    donationTotalCents: isDemoMode ? sampleDonationTotalCents : 0,
  };
}

/** Room name lookup — falls back to the sample rooms in demo mode. */
export async function getRoomNameMap(): Promise<Map<string, string>> {
  if (isDemoMode) return new Map(sampleRooms.map((r) => [r.id, r.name]));
  const supabase = await getServerSupabase();
  if (!supabase) return new Map();
  const { data } = await supabase.from("rooms").select("id, name");
  return new Map(((data as { id: string; name: string }[]) ?? []).map((r) => [r.id, r.name]));
}

/** Contact name lookup, for joining onto invoices and bookings. */
export async function getContactNameMap(): Promise<Map<string, ContactRow>> {
  const contacts = await getContacts();
  return new Map(contacts.map((c) => [c.id, c]));
}
