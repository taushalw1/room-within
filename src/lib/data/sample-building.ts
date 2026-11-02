import { addDays, addMonths, format } from "date-fns";
import type { ContractorRow, RecurringTaskRow, WarrantyRow } from "./types";

/** Sample contractors, recurring jobs and warranties, for demo mode. */

const day = (n: number) => format(addDays(new Date(), n), "yyyy-MM-dd");
const months = (n: number) => format(addMonths(new Date(), n), "yyyy-MM-dd");
const iso = (n: number) => addDays(new Date(), n).toISOString();

export const sampleContractors: ContractorRow[] = [
  {
    id: "con-1",
    name: "Dale Hryniuk",
    trade: "Handyman",
    phone: "403-555-0119",
    email: null,
    notes: "Does most things. Prefers a phone call to a text.",
    how_it_went: "Planed and rehung the front door in an afternoon. Fair price.",
    is_active: true,
    created_at: iso(-300),
    updated_at: iso(-20),
  },
  {
    id: "con-2",
    name: "Prairie Plumbing & Heating",
    trade: "Plumbing and heating",
    phone: "403-555-0188",
    email: "service@prairieph.example.ca",
    notes: "Taber. Out-of-hours charge after 5pm.",
    how_it_went: "Slow to come out in November, but the work held.",
    is_active: true,
    created_at: iso(-420),
    updated_at: iso(-60),
  },
  {
    id: "con-3",
    name: "Lethbridge Electric",
    trade: "Electrical",
    phone: "403-555-0144",
    email: null,
    notes: "The only ones who will touch the old panel.",
    how_it_went: null,
    is_active: true,
    created_at: iso(-200),
    updated_at: iso(-200),
  },
];

export const sampleRecurringTasks: RecurringTaskRow[] = [
  {
    id: "rt-1",
    title: "Furnace serviced before winter",
    detail: "Filters, burners, and a look at the flue. Book in September.",
    unit_id: null,
    area: "Whole building",
    every_months: 12,
    last_done_on: months(-11),
    next_due_on: months(1),
    contractor_id: "con-2",
    is_active: true,
    created_at: iso(-400),
    updated_at: iso(-30),
  },
  {
    id: "rt-2",
    title: "Gutters cleared",
    detail: "Twice a year — after the leaves, and after the thaw.",
    unit_id: null,
    area: "Outside",
    every_months: 6,
    last_done_on: months(-7),
    next_due_on: day(-12),
    contractor_id: "con-1",
    is_active: true,
    created_at: iso(-380),
    updated_at: iso(-200),
  },
  {
    id: "rt-3",
    title: "Smoke alarms tested",
    detail: "Every unit and the hallways. Write down the date on each one.",
    unit_id: null,
    area: "Whole building",
    every_months: 6,
    last_done_on: months(-5),
    next_due_on: months(1),
    contractor_id: null,
    is_active: true,
    created_at: iso(-380),
    updated_at: iso(-150),
  },
];

export const sampleWarranties: WarrantyRow[] = [
  {
    id: "w-1",
    item: "Furnace — Lennox, basement",
    unit_id: null,
    supplier: "Prairie Plumbing & Heating",
    supplier_phone: "403-555-0188",
    purchased_on: months(-40),
    expires_on: months(80),
    cost_cents: 648000,
    document_path: null,
    notes: "Ten years on parts, two on labour. Keep the serial number photo.",
    created_at: iso(-400),
    updated_at: iso(-400),
  },
  {
    id: "w-2",
    item: "Hot water tank",
    unit_id: null,
    supplier: "Prairie Plumbing & Heating",
    supplier_phone: "403-555-0188",
    purchased_on: months(-30),
    expires_on: months(2),
    cost_cents: 192000,
    document_path: null,
    notes: "Six-year tank. Worth a look before the cover runs out.",
    created_at: iso(-300),
    updated_at: iso(-300),
  },
];
