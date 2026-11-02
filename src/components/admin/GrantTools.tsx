"use client";

import { useActionState, useEffect, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  FileText,
  Mail,
  Phone,
  Send,
  Sparkles,
} from "lucide-react";
import {
  saveGrantDetails,
  saveOutreachDraft,
  sendOutreach,
} from "@/app/(admin)/admin/grants/actions";
import { Button, ButtonLink } from "@/components/ui/Button";
import {
  Feedback,
  Field,
  SubmitButton,
  inputClass,
} from "@/components/ui/Form";
import { dateShort } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { OpportunityRow } from "@/lib/data/types";

/* --------------------------- Who to talk to ------------------------------- */

export function GrantContact({ grant }: { grant: OpportunityRow }) {
  const [editing, setEditing] = useState(false);
  const [result, action] = useActionState(saveGrantDetails, null);

  useEffect(() => {
    if (result?.ok) setEditing(false);
  }, [result]);

  const hasAny =
    grant.contact_email || grant.contact_phone || grant.contact_name;

  if (!editing) {
    return (
      <div className="space-y-4">
        {hasAny ? (
          <div className="space-y-2.5">
            {grant.contact_name && (
              <p className="font-medium text-ink">{grant.contact_name}</p>
            )}
            {grant.contact_email && (
              <p className="flex items-center gap-2.5 text-sm">
                <Mail className="h-4 w-4 shrink-0 text-olive" aria-hidden />
                <a
                  href={`mailto:${grant.contact_email}`}
                  className="text-burgundy hover:underline"
                >
                  {grant.contact_email}
                </a>
              </p>
            )}
            {grant.contact_phone && (
              <p className="flex items-center gap-2.5 text-sm">
                <Phone className="h-4 w-4 shrink-0 text-olive" aria-hidden />
                <a
                  href={`tel:${grant.contact_phone.replace(/[^0-9+]/g, "")}`}
                  className="text-burgundy hover:underline"
                >
                  {grant.contact_phone}
                </a>
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-ink-soft">
            No contact details yet. The weekly search looks for them, but plenty
            of funders don&rsquo;t publish one — it&rsquo;s usually on their
            &ldquo;contact us&rdquo; page.
          </p>
        )}

        {grant.match_percent != null && (
          <div className="rounded-[var(--radius-card)] bg-parchment/60 px-4 py-3">
            <p className="text-sm text-ink">
              They pay <strong>{grant.match_percent}%</strong> of the project.
              You find the other <strong>{100 - grant.match_percent}%</strong>.
            </p>
            {grant.match_note && (
              <p className="mt-1 text-xs text-ink-faint">{grant.match_note}</p>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {grant.application_url && (
            <ButtonLink
              href={grant.application_url}
              target="_blank"
              rel="noopener noreferrer"
              size="sm"
              variant="secondary"
            >
              <FileText className="h-3.5 w-3.5" aria-hidden />
              The application form
            </ButtonLink>
          )}
          <Button
            size="sm"
            variant="ghost"
            type="button"
            onClick={() => setEditing(true)}
          >
            {hasAny ? "Change these" : "Fill these in"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="id" value={grant.id} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Who to ask for">
          <input
            name="contactName"
            defaultValue={grant.contact_name ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Their email">
          <input
            name="contactEmail"
            type="email"
            defaultValue={grant.contact_email ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Their phone">
          <input
            name="contactPhone"
            defaultValue={grant.contact_phone ?? ""}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="What share they pay"
          hint="A number. One-to-one matching is 50."
        >
          <input
            name="matchPercent"
            type="number"
            min="0"
            max="100"
            defaultValue={grant.match_percent ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Anything about the match" className="sm:col-span-2">
          <input
            name="matchNote"
            defaultValue={grant.match_note ?? ""}
            placeholder="Donated labour can count toward it."
            className={inputClass}
          />
        </Field>
      </div>

      <Field
        label="Link to the application form"
        hint="Usually a PDF on their site. Paste the address from your browser."
      >
        <input
          name="applicationUrl"
          type="url"
          defaultValue={grant.application_url ?? ""}
          placeholder="https://"
          className={inputClass}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>Save</SubmitButton>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setEditing(false)}
        >
          Cancel
        </Button>
        <Feedback result={result} />
      </div>
    </form>
  );
}

/* ------------------------- The email to the funder ------------------------- */

export function GrantOutreach({
  grant,
  draft,
}: {
  grant: OpportunityRow;
  draft: { to: string; subject: string; body: string };
}) {
  const [sendResult, sendAction] = useActionState(sendOutreach, null);
  const [saveResult, saveAction] = useActionState(saveOutreachDraft, null);
  const [confirming, setConfirming] = useState(false);

  const sent = Boolean(grant.outreach_sent_at);

  return (
    <div className="space-y-4">
      {sent && (
        <p className="rounded-[var(--radius-card)] bg-sage-pale/50 px-4 py-3 text-sm text-ink">
          Sent to <strong>{grant.outreach_to}</strong> on{" "}
          {dateShort(grant.outreach_sent_at!)}. You can send another if you
          need to — edit it below.
        </p>
      )}

      <form action={sendAction} className="space-y-4">
        <input type="hidden" name="id" value={grant.id} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="To">
            <input
              name="to"
              type="email"
              required
              defaultValue={grant.outreach_to ?? draft.to}
              placeholder="grants@example.ca"
              className={inputClass}
            />
          </Field>
          <Field label="Subject">
            <input
              name="subject"
              required
              defaultValue={grant.outreach_subject ?? draft.subject}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="The message" hint="Change anything. It's your email.">
          <textarea
            name="body"
            rows={16}
            required
            defaultValue={grant.outreach_draft ?? draft.body}
            className={`${inputClass} resize-y font-body leading-relaxed`}
          />
        </Field>

        {confirming ? (
          <div className="space-y-3 rounded-[var(--radius-card)] border border-olive/30 bg-sage-pale/30 p-4">
            <p className="text-sm text-ink">
              This sends the message above straight away. Replies come back to
              you. Ready?
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <SubmitButton>
                <Send className="h-3.5 w-3.5" aria-hidden />
                Yes, send it
              </SubmitButton>
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={() => setConfirming(false)}
              >
                Not yet
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" type="button" onClick={() => setConfirming(true)}>
              <Send className="h-3.5 w-3.5" aria-hidden />
              {sent ? "Send another" : "Send it"}
            </Button>
            <button
              type="submit"
              formAction={saveAction}
              className="eyebrow rounded-full border border-tan/40 bg-cream px-3.5 py-1.5 !text-[0.58rem] text-bark transition-colors hover:border-olive/50"
            >
              Just save the draft
            </button>
            <Feedback result={saveResult} />
          </div>
        )}

        <Feedback result={sendResult} />
      </form>

      <p className="text-xs leading-relaxed text-ink-faint">
        It asks for a short call rather than making the whole case, because a
        twenty-minute conversation that ends in &ldquo;you&rsquo;re not
        eligible&rdquo; is worth more than a weekend spent on an application
        that was never going to work. It also says plainly that Room Within is
        a sole proprietorship — that is the first thing most funders check.
      </p>
    </div>
  );
}

/* --------------------------- The Claude prompt ----------------------------- */

export function GrantAssistantPrompt({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard permission can be refused; the text is on screen either way.
      setOpen(true);
    }
  }

  return (
    <div className="space-y-4">
      <ol className="space-y-2 text-sm leading-relaxed text-ink-soft">
        <li>
          <strong className="text-ink">1.</strong> Copy the briefing below.
        </li>
        <li>
          <strong className="text-ink">2.</strong> Open Claude and paste it into
          a new chat.
        </li>
        <li>
          <strong className="text-ink">3.</strong> If there&rsquo;s an
          application form linked above, download it and drop the file into that
          same chat.
        </li>
        <li>
          <strong className="text-ink">4.</strong> It&rsquo;ll start asking you
          questions, one at a time. &ldquo;I don&rsquo;t know&rdquo; is a fine
          answer — it&rsquo;ll tell you how to find out, and offer to write the
          email that asks.
        </li>
      </ol>

      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" type="button" onClick={copy}>
          {copied ? (
            <Check className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden />
          )}
          {copied ? "Copied" : "Copy the briefing"}
        </Button>
        <ButtonLink
          href="https://claude.ai/new"
          target="_blank"
          rel="noopener noreferrer"
          size="sm"
          variant="secondary"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          Open Claude
        </ButtonLink>
        <Button
          size="sm"
          variant="ghost"
          type="button"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide it" : "Read it first"}
        </Button>
      </div>

      {open && (
        <pre
          className={cn(
            "max-h-[28rem] overflow-auto rounded-[var(--radius-card)]",
            "border border-tan/30 bg-cream p-4",
            "whitespace-pre-wrap font-body text-xs leading-relaxed text-ink-soft",
          )}
        >
          {prompt}
        </pre>
      )}

      <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-faint">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sage" aria-hidden />
        The briefing already contains everything about the building and this
        grant, so you don&rsquo;t have to explain any of it again.
      </p>
    </div>
  );
}
