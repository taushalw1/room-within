"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { getServerSupabase } from "@/lib/supabase/server";
import { readBankFile } from "@/lib/bank-csv";
import { GST_RATE } from "@/lib/pricing";

export type ActionResult = { ok: boolean; message: string; importId?: string };

const DEMO: ActionResult = {
  ok: false,
  message: "Demo mode — nothing was saved.",
};

// A bank statement is a few kilobytes. Anything this size is not one, and
// reading it would tie up the server for no good reason.
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Read a statement in.
 *
 * Nothing is matched here. The file is turned into rows, every row is stored
 * as `open`, and the matching is worked out when the page is drawn — so a
 * proposal is never mistaken for a decision, and improving the matching later
 * doesn't leave old statements stuck with yesterday's guesses.
 */
export async function importStatement(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose the file your bank gave you first." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, message: "That file is far too big to be a statement." };
  }

  const text = await file.text();
  const read = readBankFile(text);

  if ("error" in read) return { ok: false, message: read.error };

  // The demo reads the file properly and then stops. Saying what it found is
  // more use than refusing outright — it is the half anybody trying the demo
  // actually wants to know works, and it needs no database to prove.
  if (isDemoMode) {
    return {
      ok: false,
      message:
        `Read ${read.rows.length} line${read.rows.length === 1 ? "" : "s"} from ` +
        `"${read.reading.columns.date}" and "${read.reading.columns.amount}", ` +
        `dates ${read.reading.dateOrder}. Demo mode — nothing was saved.`,
    };
  }

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No connection just now." };

  const dates = read.rows.map((r) => r.date).sort();

  const { data: statement, error } = await supabase
    .from("bank_imports")
    .insert({
      filename: file.name,
      period_start: dates[0],
      period_end: dates[dates.length - 1],
      line_count: read.rows.length,
      money_in_cents: read.rows
        .filter((r) => r.amountCents > 0)
        .reduce((sum, r) => sum + r.amountCents, 0),
      money_out_cents: read.rows
        .filter((r) => r.amountCents < 0)
        .reduce((sum, r) => sum + r.amountCents, 0),
      reading: read.reading,
    })
    .select("id")
    .single();

  if (error) return { ok: false, message: `Couldn't save that: ${error.message}` };

  const importId = (statement as { id: string }).id;

  const { error: linesError } = await supabase.from("bank_lines").insert(
    read.rows.map((r) => ({
      import_id: importId,
      line_no: r.line,
      occurred_on: r.date,
      description: r.description,
      amount_cents: r.amountCents,
    })),
  );

  if (linesError) {
    // The statement row without its lines is worse than nothing — it would
    // show up as a statement she has read with no content. Take it back out.
    await supabase.from("bank_imports").delete().eq("id", importId);
    return { ok: false, message: `Couldn't save the rows: ${linesError.message}` };
  }

  revalidatePath("/admin/bank");

  const skipped =
    read.skipped.length > 0
      ? ` ${read.skipped.length} row${read.skipped.length === 1 ? "" : "s"} couldn't be read — they're listed below.`
      : "";

  return {
    ok: true,
    message: `Read ${read.rows.length} line${read.rows.length === 1 ? "" : "s"}.${skipped}`,
    importId,
  };
}

/* -------------------------------------------------------------------------- */
/*  Deciding what a line is                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Only an open line can be decided.
 *
 * Every decision below goes through this, so a second click on a stale page —
 * or two tabs open on the same statement — cannot overwrite a decision already
 * made. The guard is in the `eq("status", "open")` rather than in a check
 * beforehand, so it is the database that refuses rather than a race between
 * reading and writing.
 */
async function decide(
  lineId: string,
  patch: Record<string, unknown>,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (isDemoMode) return DEMO;

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No connection just now." };

  const { data, error } = await supabase
    .from("bank_lines")
    .update({
      ...patch,
      decided_by: admin.id,
      decided_at: new Date().toISOString(),
    })
    .eq("id", lineId)
    .eq("status", "open")
    .select("id");

  if (error) return { ok: false, message: error.message };
  if (!data || data.length === 0) {
    return {
      ok: false,
      message: "That line has already been dealt with — reload the page to see it.",
    };
  }

  revalidatePath("/admin/bank");
  return { ok: true, message: "Ticked off." };
}

const matchSchema = z.object({
  lineId: z.string().uuid(),
  kind: z.enum(["payment", "expense"]),
  entryId: z.string().uuid(),
});

/** Tick a statement line off against something already recorded. */
export async function matchLine(formData: FormData): Promise<ActionResult> {
  const parsed = matchSchema.safeParse({
    lineId: formData.get("lineId"),
    kind: formData.get("kind"),
    entryId: formData.get("entryId"),
  });

  if (!parsed.success) return { ok: false, message: "That didn't come through." };

  const { lineId, kind, entryId } = parsed.data;

  return decide(lineId, {
    status: "matched",
    payment_id: kind === "payment" ? entryId : null,
    expense_id: kind === "expense" ? entryId : null,
  });
}

const ignoreSchema = z.object({
  lineId: z.string().uuid(),
  note: z.string().trim().min(3, "Say briefly why, so it makes sense later."),
});

/**
 * Set a line aside.
 *
 * The reason is required rather than optional. A line marked as nothing, with
 * no explanation, is indistinguishable from a mistake the moment anybody looks
 * at it again — including her, in February.
 */
export async function ignoreLine(formData: FormData): Promise<ActionResult> {
  const parsed = ignoreSchema.safeParse({
    lineId: formData.get("lineId"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  return decide(parsed.data.lineId, {
    status: "ignored",
    note: parsed.data.note,
  });
}

const addExpenseSchema = z.object({
  lineId: z.string().uuid(),
  category: z.string().trim().min(1, "Give it a category."),
  vendor: z.string().trim().max(120).optional(),
});

/**
 * Turn an unexplained outgoing into a cost.
 *
 * The amount and the date come from the statement rather than from the form,
 * because the statement is the evidence — letting either be typed here is how
 * a cost ends up recorded for a different amount than actually left the bank.
 */
export async function addLineAsExpense(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (isDemoMode) return DEMO;

  const parsed = addExpenseSchema.safeParse({
    lineId: formData.get("lineId"),
    category: formData.get("category"),
    vendor: formData.get("vendor"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No connection just now." };

  const { data: line } = await supabase
    .from("bank_lines")
    .select("id, occurred_on, description, amount_cents, status")
    .eq("id", parsed.data.lineId)
    .maybeSingle();

  if (!line) return { ok: false, message: "I can't find that line." };

  const row = line as {
    occurred_on: string;
    description: string;
    amount_cents: number;
    status: string;
  };

  if (row.status !== "open") {
    return {
      ok: false,
      message: "That line has already been dealt with — reload the page to see it.",
    };
  }
  if (row.amount_cents >= 0) {
    return { ok: false, message: "That line is money coming in, not a cost." };
  }

  const amountCents = Math.abs(row.amount_cents);

  const { data: expense, error } = await supabase
    .from("expenses")
    .insert({
      incurred_on: row.occurred_on,
      vendor: parsed.data.vendor || null,
      category: parsed.data.category,
      description: row.description || null,
      amount_cents: amountCents,
      // Same reasoning as the Add a cost panel: the amount is what left the
      // bank, so the GST is worked back out of it rather than added on top.
      tax_cents: Math.round(amountCents - amountCents / (1 + GST_RATE)),
      payment_method: "bank",
      notes: "Added from a bank statement.",
    })
    .select("id")
    .single();

  if (error) return { ok: false, message: `Couldn't record that: ${error.message}` };

  const expenseId = (expense as { id: string }).id;

  const { data: updated, error: linkError } = await supabase
    .from("bank_lines")
    .update({
      status: "added",
      expense_id: expenseId,
      decided_by: admin.id,
      decided_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.lineId)
    .eq("status", "open")
    .select("id");

  if (linkError || !updated || updated.length === 0) {
    // The cost exists but nothing points at it, which would leave it looking
    // like a duplicate next time. Undo rather than leave that behind.
    await supabase.from("expenses").delete().eq("id", expenseId);
    return {
      ok: false,
      message: "That line was dealt with while I was working — nothing was changed.",
    };
  }

  revalidatePath("/admin/bank");
  revalidatePath("/admin/finance");
  return { ok: true, message: "Recorded as a cost." };
}

/** Put a decided line back to undecided. */
export async function reopenLine(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (isDemoMode) return DEMO;

  const lineId = z.string().uuid().safeParse(formData.get("lineId"));
  if (!lineId.success) return { ok: false, message: "That didn't come through." };

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No connection just now." };

  // Deliberately does not delete a cost that was created from this line. The
  // cost may already have been edited, attached to a receipt or reported on,
  // and silently removing it to undo a tick is not a trade anybody would
  // agree to. It is unlinked, and says so.
  const { error } = await supabase
    .from("bank_lines")
    .update({
      status: "open",
      payment_id: null,
      expense_id: null,
      note: null,
      decided_by: admin.id,
      decided_at: null,
    })
    .eq("id", lineId.data);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/bank");
  return {
    ok: true,
    message:
      "Open again. Anything that was created from it is still on your books — " +
      "remove it on the Finance page if you don't want it.",
  };
}

/* -------------------------------------------------------------------------- */
/*  Correcting how a file was read                                            */
/* -------------------------------------------------------------------------- */

/**
 * Turn every amount in a statement the other way round.
 *
 * For a file whose amounts were all one sign, so it never said which way the
 * money went. Only offered while every line is still open, because flipping
 * the signs underneath decisions already made would turn correct ticks into
 * nonsense.
 */
export async function flipStatement(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const importId = z.string().uuid().safeParse(formData.get("importId"));
  if (!importId.success) return { ok: false, message: "That didn't come through." };

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No connection just now." };

  const { data: lines } = await supabase
    .from("bank_lines")
    .select("id, amount_cents, status")
    .eq("import_id", importId.data);

  const rows = (lines as { id: string; amount_cents: number; status: string }[]) ?? [];

  if (rows.some((r) => r.status !== "open")) {
    return {
      ok: false,
      message:
        "Some of these lines have already been ticked off, so turning them " +
        "round would make a mess. Delete the statement and read it in again.",
    };
  }

  for (const row of rows) {
    await supabase
      .from("bank_lines")
      .update({ amount_cents: -row.amount_cents })
      .eq("id", row.id);
  }

  const moneyIn = rows
    .filter((r) => -r.amount_cents > 0)
    .reduce((sum, r) => sum - r.amount_cents, 0);
  const moneyOut = rows
    .filter((r) => -r.amount_cents < 0)
    .reduce((sum, r) => sum - r.amount_cents, 0);

  await supabase
    .from("bank_imports")
    .update({ money_in_cents: moneyIn, money_out_cents: moneyOut })
    .eq("id", importId.data);

  revalidatePath("/admin/bank");
  return { ok: true, message: "Turned round." };
}

/**
 * Read a statement's dates the other way round.
 *
 * Only possible at all when every date in the file could be read either way —
 * which is exactly when the file was flagged as ambiguous. Where a date
 * settles the question itself (a 24th can only be a day) there is nothing to
 * swap, and the swap is refused rather than silently producing an invalid date.
 */
export async function swapStatementDates(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const importId = z.string().uuid().safeParse(formData.get("importId"));
  if (!importId.success) return { ok: false, message: "That didn't come through." };

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No connection just now." };

  const { data: lines } = await supabase
    .from("bank_lines")
    .select("id, occurred_on, status")
    .eq("import_id", importId.data);

  const rows = (lines as { id: string; occurred_on: string; status: string }[]) ?? [];

  if (rows.some((r) => r.status !== "open")) {
    return {
      ok: false,
      message:
        "Some of these lines have already been ticked off. Delete the " +
        "statement and read it in again.",
    };
  }

  const swapped: { id: string; date: string }[] = [];

  for (const row of rows) {
    const [year, month, day] = row.occurred_on.split("-");
    if (Number(day) > 12) {
      return {
        ok: false,
        message:
          `Line dated ${row.occurred_on} can only be read one way round, so ` +
          "the dates in this file aren't the problem.",
      };
    }
    swapped.push({ id: row.id, date: `${year}-${day}-${month}` });
  }

  for (const s of swapped) {
    await supabase
      .from("bank_lines")
      .update({ occurred_on: s.date })
      .eq("id", s.id);
  }

  const dates = swapped.map((s) => s.date).sort();

  await supabase
    .from("bank_imports")
    .update({ period_start: dates[0], period_end: dates[dates.length - 1] })
    .eq("id", importId.data);

  revalidatePath("/admin/bank");
  return { ok: true, message: "Dates swapped round." };
}

/** Remove a statement and everything read from it. */
export async function deleteStatement(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  if (isDemoMode) return DEMO;

  const importId = z.string().uuid().safeParse(formData.get("importId"));
  if (!importId.success) return { ok: false, message: "That didn't come through." };

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "No connection just now." };

  // The lines go with it, by the cascade on the table. Costs created from
  // those lines stay — they are real records of money that really left.
  const { error } = await supabase
    .from("bank_imports")
    .delete()
    .eq("id", importId.data);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/bank");
  return {
    ok: true,
    message: "Statement removed. Anything you recorded from it is still there.",
  };
}
