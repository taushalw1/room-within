import { Badge, Card, CardHeader, EmptyRow, Table, Td, Th } from "@/components/ui/Table";
import { getContacts, getInvoices } from "@/lib/data/admin";
import { dateShort, money } from "@/lib/format";

export default async function ContactsPage() {
  const [contacts, invoices] = await Promise.all([getContacts(), getInvoices()]);

  const owedByContact = new Map<string, number>();
  for (const i of invoices) {
    if (i.state === "overdue" || i.state === "outstanding") {
      owedByContact.set(
        i.contact_id,
        (owedByContact.get(i.contact_id) ?? 0) + i.balance_cents,
      );
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl">People</h1>
        <p className="mt-1.5 text-ink-soft">
          Everyone you deal with — tenants, people who book rooms, counselling
          clients and donors.
        </p>
      </header>

      <Card>
        <CardHeader
          title={`${contacts.length} ${contacts.length === 1 ? "person" : "people"}`}
          description="Someone can be more than one thing at once."
        />
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Contact</Th>
              <Th>Relationship</Th>
              <Th>Since</Th>
              <Th align="right">Owing</Th>
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 ? (
              <EmptyRow colSpan={5}>
                No one added yet. Ask Claude to add someone.
              </EmptyRow>
            ) : (
              contacts.map((c) => {
                const owed = owedByContact.get(c.id) ?? 0;
                return (
                  <tr key={c.id}>
                    <Td>
                      <span className="font-medium">{c.full_name}</span>
                      {c.organisation && (
                        <span className="block text-xs text-ink-faint">
                          {c.organisation}
                        </span>
                      )}
                    </Td>
                    <Td className="text-ink-soft">
                      {c.email && <span className="block text-xs">{c.email}</span>}
                      {c.phone && <span className="block text-xs">{c.phone}</span>}
                      {!c.email && !c.phone && "—"}
                    </Td>
                    <Td>
                      <span className="flex flex-wrap gap-1">
                        {c.tags.length === 0 ? (
                          <span className="text-ink-faint">—</span>
                        ) : (
                          c.tags.map((t) => (
                            <Badge key={t} tone={t === "tenant" ? "good" : "neutral"}>
                              {t}
                            </Badge>
                          ))
                        )}
                      </span>
                    </Td>
                    <Td className="text-ink-soft">{dateShort(c.created_at)}</Td>
                    <Td
                      align="right"
                      className={owed > 0 ? "font-semibold text-burgundy" : "text-ink-faint"}
                    >
                      {owed > 0 ? money(owed) : "—"}
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </Table>
      </Card>

      <p className="text-xs text-ink-faint">
        Counselling clients appear here by name only. Anything clinical lives in
        the Counselling section, which nobody else can open.
      </p>
    </div>
  );
}
