import { AddPanel } from "@/components/admin/AddPanel";
import { AddTenantForm } from "@/components/admin/AddTenantForm";
import { ContactRow } from "@/components/admin/ContactRow";
import { Card, CardHeader, EmptyRow, Table, Th } from "@/components/ui/Table";
import { getContacts, getInvoices, getUnits } from "@/lib/data/admin";

export default async function ContactsPage() {
  const [contacts, invoices, units] = await Promise.all([
    getContacts(),
    getInvoices(),
    getUnits(),
  ]);

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

      <AddPanel
        label="Add someone"
        description="Anyone you deal with. Give them a unit as well and they become a tenant."
      >
        <AddTenantForm units={units} />
      </AddPanel>

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
              <Th align="right" />
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 ? (
              <EmptyRow colSpan={6}>
                No one added yet. Use the button above.
              </EmptyRow>
            ) : (
              contacts.map((c) => (
                <ContactRow
                  key={c.id}
                  contact={c}
                  owed={owedByContact.get(c.id) ?? 0}
                />
              ))
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
