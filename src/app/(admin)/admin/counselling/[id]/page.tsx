import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { NoteEditor } from "@/components/admin/NoteEditor";
import { Card, CardHeader } from "@/components/ui/Table";
import { requireAdmin } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { getServerSupabase, getServiceSupabase } from "@/lib/supabase/server";
import { sampleAppointments } from "@/lib/data/sample-admin";
import { dateTimeRange } from "@/lib/format";
import type { AppointmentRow } from "@/lib/data/types";

export const metadata = { robots: { index: false, follow: false } };

export default async function SessionNotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireAdmin();
  const { id } = await params;

  let appointment: AppointmentRow | null = null;
  let note = "";

  if (isDemoMode) {
    appointment = sampleAppointments.find((a) => a.id === id) ?? null;
    note =
      "This is a sample note so you can see how the page works.\n\nNothing typed here is saved while the app is in demo mode.";
  } else {
    const supabase = await getServerSupabase();
    if (!supabase) notFound();

    const { data: appt } = await supabase
      .from("counselling_appointments")
      .select("*")
      .eq("id", id)
      .single();

    appointment = (appt as AppointmentRow) ?? null;

    if (appointment) {
      const { data: noteRow } = await supabase
        .from("counselling_notes")
        .select("body")
        .eq("appointment_id", id)
        .maybeSingle();

      note = (noteRow?.body as string) ?? "";

      // Record that this note was opened. Written with the service key because
      // the log is append-only — no policy grants anyone insert rights.
      const service = getServiceSupabase();
      await service?.from("counselling_access_log").insert({
        note_id: id,
        actor_id: admin.id,
        action: "view",
      });
    }
  }

  if (!appointment) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/admin/counselling"
        className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-olive-deep"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to counselling
      </Link>

      <header>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl">{appointment.client_name}</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blush px-3 py-1">
            <Lock className="h-3 w-3 text-burgundy" aria-hidden />
            <span className="eyebrow !text-[0.55rem] text-burgundy">
              Only you
            </span>
          </span>
        </div>
        <p className="mt-1.5 text-sm text-ink-soft">
          {dateTimeRange(appointment.starts_at, appointment.ends_at)} ·{" "}
          {appointment.kind.replace("_", " ")} ·{" "}
          {appointment.location ?? "No location"}
        </p>
      </header>

      <Card>
        <CardHeader
          title="Session note"
          description="Saved only when you press Save."
        />
        <NoteEditor appointmentId={appointment.id} initialBody={note} />
      </Card>

      <p className="text-xs text-ink-faint">
        Opening this page has been recorded in the access log, along with the
        time and your account.
      </p>
    </div>
  );
}
