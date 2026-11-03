import { Mail } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { AddPanel } from "@/components/admin/AddPanel";
import { MessageComposer } from "@/components/admin/MessageComposer";
import { TemplateForm } from "@/components/admin/TemplateForm";
import {
  Badge,
  Card,
  CardHeader,
  EmptyRow,
  Table,
  Td,
  Th,
} from "@/components/ui/Table";
import { getMessageTemplates, getSentMessages } from "@/lib/data/messages";
import { getContacts } from "@/lib/data/admin";
import { dateShort, timeOnly } from "@/lib/format";

export const metadata = { title: "Messages · Room Within" };

export default async function MessagesPage() {
  const [templates, sent, contacts] = await Promise.all([
    getMessageTemplates(),
    getSentMessages(30),
    getContacts(),
  ]);

  const people = contacts.map((c) => ({
    id: c.id,
    name: c.full_name,
    email: c.email,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People"
        title="Messages"
        description="The four or five emails you write over and over, written once and kept."
      />

      <Card>
        <CardHeader
          title="Send one"
          description="Pick a message and a person. You'll see exactly what they get before anything goes."
          tone="olive"
        />
        <MessageComposer templates={templates} people={people} />
      </Card>

      <AddPanel
        label="Write a new saved message"
        title="A new saved message"
        description="Use the blanks — {{first_name}}, {{unit}} — and they get filled in for whoever you send it to."
      >
        <TemplateForm />
      </AddPanel>

      <Card>
        <CardHeader
          title="Saved messages"
          description="Edit one and it changes for next time. Anything already sent stays as it was sent."
        />
        {templates.length === 0 ? (
          <EmptyRow colSpan={1}>Nothing saved yet.</EmptyRow>
        ) : (
          templates.map((t) => (
            <details key={t.id} className="border-b border-tan/20">
              <summary className="cursor-pointer px-5 py-3.5 hover:bg-sage-pale/30">
                <span className="font-medium text-ink">{t.name}</span>
                <span className="ml-2 text-sm text-ink-faint">{t.subject}</span>
              </summary>
              <div className="px-5 pb-5">
                <TemplateForm template={t} />
              </div>
            </details>
          ))
        )}
      </Card>

      <Card>
        <CardHeader
          title="What you've sent"
          description="So you know whether you've already chased someone, without going through your own inbox."
          tone="plain"
        />
        <Table>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Who</Th>
              <Th>About</Th>
              <Th align="right" />
            </tr>
          </thead>
          <tbody>
            {sent.length === 0 ? (
              <EmptyRow colSpan={4}>
                Nothing sent from here yet.
              </EmptyRow>
            ) : (
              sent.map((m) => (
                <tr key={m.id}>
                  <Td>
                    {dateShort(m.sent_at)}
                    <span className="block text-xs text-ink-faint">
                      {timeOnly(m.sent_at)}
                    </span>
                  </Td>
                  <Td>
                    {m.to_name ?? m.to_email}
                    <span className="block text-xs text-ink-faint">
                      {m.to_email}
                    </span>
                  </Td>
                  <Td>{m.subject}</Td>
                  <Td align="right">
                    {m.delivered ? (
                      <Badge tone="good">sent</Badge>
                    ) : (
                      <Badge tone="bad">failed</Badge>
                    )}
                    {!m.delivered && m.failure && (
                      <span className="block text-xs text-ink-faint">
                        {m.failure}
                      </span>
                    )}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-faint">
        <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sage" aria-hidden />
        Messages go out from the building&rsquo;s address with your address as
        the reply-to, so anybody who replies reaches you. What was sent is
        recorded word for word, not as a template and a set of values — so
        editing a saved message never changes what somebody was actually told.
      </p>
    </div>
  );
}
