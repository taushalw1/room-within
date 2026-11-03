"use client";

import { useActionState, useState, useTransition } from "react";
import { Archive, Save } from "lucide-react";
import {
  retireTemplate,
  saveTemplate,
  type ActionResult,
} from "@/app/(admin)/admin/messages/actions";
import { Button } from "@/components/ui/Button";
import { Feedback, Field, SubmitButton, inputClass } from "@/components/ui/Form";
import { previewWith } from "@/lib/templates";
import type { MessageTemplateRow } from "@/lib/data/types";

/**
 * Write or change a saved message.
 *
 * The live preview uses example values rather than a real person, because
 * this form is for writing the thing, not for sending it — and a writer needs
 * to see the shape of the sentence, not somebody's actual balance.
 *
 * A misspelled blank is called out as it is typed. Catching `{{frist_name}}`
 * here costs nothing; catching it after it has gone to a tenant is not
 * possible.
 */
export function TemplateForm({ template }: { template?: MessageTemplateRow }) {
  const [result, action] = useActionState<ActionResult | null, FormData>(
    saveTemplate,
    null,
  );
  const [body, setBody] = useState(template?.body ?? "");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [retired, setRetired] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  const shown = previewWith(`${subject}\n${body}`);

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        {template && <input type="hidden" name="id" value={template.id} />}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Call it" hint="Just for you — they never see this.">
            <input
              name="name"
              required
              defaultValue={template?.name ?? ""}
              placeholder="Rent is overdue"
              className={inputClass}
            />
          </Field>

          <Field label="Subject line">
            <input
              name="subject"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Rent for {{unit}}"
              className={inputClass}
            />
          </Field>
        </div>

        <Field
          label="The message"
          hint="Write it as you'd say it. Use {{first_name}}, {{unit}}, {{balance}} and the rest — they get filled in."
        >
          <textarea
            name="body"
            required
            rows={12}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className={`${inputClass} font-body`}
          />
        </Field>

        {shown.unknown.length > 0 && (
          <p className="text-sm text-burgundy">
            {shown.unknown.map((u) => `{{${u}}}`).join(", ")}{" "}
            {shown.unknown.length === 1 ? "isn't" : "aren't"} something I can
            fill in — check the spelling, or it&rsquo;ll go out with the
            braces still in it.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton>
            <Save className="h-4 w-4" aria-hidden />
            {template ? "Save the changes" : "Save it"}
          </SubmitButton>
          <Feedback result={result} />
        </div>
      </form>

      {template && (
        <div className="flex flex-wrap items-center gap-3 border-t border-tan/20 pt-4">
          <Button
            size="sm"
            variant="ghost"
            type="button"
            disabled={pending}
            onClick={() => {
              const fd = new FormData();
              fd.set("id", template.id);
              start(async () => setRetired(await retireTemplate(fd)));
            }}
          >
            <Archive className="h-3.5 w-3.5" aria-hidden />
            Put this one away
          </Button>
          <Feedback result={retired} />
        </div>
      )}
    </div>
  );
}
