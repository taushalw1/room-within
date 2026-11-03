"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Eye, Send, TriangleAlert } from "lucide-react";
import {
  previewForContact,
  sendMessage,
  type ActionResult,
} from "@/app/(admin)/admin/messages/actions";
import { Feedback, Field, SubmitButton, inputClass } from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";
import { PLACEHOLDERS } from "@/lib/templates";
import type { MessageTemplateRow } from "@/lib/data/types";

/**
 * Pick a saved message, pick a person, see exactly what they will get.
 *
 * The preview is fetched from the server rather than worked out here, because
 * the blanks are filled from the records — what they owe, when it is due —
 * and the browser does not have those. It also means the preview is produced
 * by the same code that produces the real thing, so it cannot drift from it.
 */
export function MessageComposer({
  templates,
  people,
}: {
  templates: MessageTemplateRow[];
  people: { id: string; name: string; email: string | null }[];
}) {
  const [result, action] = useActionState<ActionResult | null, FormData>(
    sendMessage,
    null,
  );

  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [contactId, setContactId] = useState(people[0]?.id ?? "");
  const [subject, setSubject] = useState(templates[0]?.subject ?? "");
  const [body, setBody] = useState(templates[0]?.body ?? "");

  const [preview, setPreview] = useState<{
    subject: string;
    body: string;
    missing: string[];
    unknown: string[];
  } | null>(null);
  const [previewing, startPreview] = useTransition();

  // Switching template replaces what is in the boxes. Edits are hers to make
  // afterwards, and they do not change the saved template.
  useEffect(() => {
    const chosen = templates.find((t) => t.id === templateId);
    if (chosen) {
      setSubject(chosen.subject);
      setBody(chosen.body);
      setPreview(null);
    }
  }, [templateId, templates]);

  const person = people.find((p) => p.id === contactId);
  const problems = preview
    ? [...preview.missing, ...preview.unknown]
    : [];

  function look() {
    startPreview(async () => {
      setPreview(await previewForContact(contactId, subject, body));
    });
  }

  if (templates.length === 0) {
    return (
      <p className="px-5 py-5 text-sm text-ink-soft">
        No saved messages yet. Write one below and it&rsquo;ll appear here.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4 px-5 py-5">
      <input type="hidden" name="templateId" value={templateId} />
      <input type="hidden" name="contactId" value={contactId} />
      <input type="hidden" name="subject" value={subject} />
      <input type="hidden" name="body" value={body} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Which message">
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className={inputClass}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Who to"
          hint={person && !person.email ? "No email address on file for them." : undefined}
        >
          <select
            value={contactId}
            onChange={(e) => {
              setContactId(e.target.value);
              setPreview(null);
            }}
            className={inputClass}
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.email ? "" : " — no email"}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Subject">
        <input
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value);
            setPreview(null);
          }}
          className={inputClass}
        />
      </Field>

      <Field
        label="Message"
        hint="Change anything you like — it only changes this one, not the saved version."
      >
        <textarea
          value={body}
          rows={12}
          onChange={(e) => {
            setBody(e.target.value);
            setPreview(null);
          }}
          className={`${inputClass} font-body`}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="secondary" type="button" onClick={look} disabled={previewing}>
          <Eye className="h-3.5 w-3.5" aria-hidden />
          Show me what they&rsquo;ll get
        </Button>
        {preview && problems.length === 0 && person?.email && (
          <SubmitButton>
            <Send className="h-4 w-4" aria-hidden />
            Send it to {person.name}
          </SubmitButton>
        )}
        <Feedback result={result} />
      </div>

      {preview && (
        <div className="rounded-[var(--radius-card)] border border-tan/30 bg-cream">
          <p className="border-b border-tan/20 px-4 py-2.5 text-xs text-ink-faint">
            To {person?.name}
            {person?.email ? ` · ${person.email}` : ""}
          </p>
          <p className="border-b border-tan/20 px-4 py-2.5 font-display text-base font-semibold text-ink">
            {preview.subject}
          </p>
          <p className="whitespace-pre-wrap px-4 py-4 font-body text-sm leading-relaxed text-ink">
            {preview.body}
          </p>
        </div>
      )}

      {problems.length > 0 && (
        <p className="flex items-start gap-2 rounded-[var(--radius-card)] bg-blush/50 px-4 py-3 text-sm text-burgundy">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            {preview?.unknown.length ? (
              <>
                {preview.unknown.map((u) => `{{${u}}}`).join(", ")} isn&rsquo;t
                something I know how to fill in — check the spelling against
                the list below.{" "}
              </>
            ) : null}
            {preview?.missing.length ? (
              <>
                There&rsquo;s nothing on file to put in{" "}
                {preview.missing.map((m) => `{{${m}}}`).join(", ")} for{" "}
                {person?.name}. Take it out, or pick someone it applies to.
              </>
            ) : null}
          </span>
        </p>
      )}

      <details className="text-xs text-ink-soft">
        <summary className="cursor-pointer text-bark">
          What you can put in a message
        </summary>
        <ul className="mt-2 space-y-1">
          {PLACEHOLDERS.map((p) => (
            <li key={p.key}>
              <code className="rounded bg-linen px-1.5 py-0.5 text-[0.7rem]">
                {`{{${p.key}}}`}
              </code>{" "}
              — {p.label} <span className="text-ink-faint">({p.example})</span>
            </li>
          ))}
        </ul>
      </details>
    </form>
  );
}
