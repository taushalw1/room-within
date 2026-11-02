/**
 * Writes a sample statement to .email-preview/statement.pdf so the layout can
 * be looked at without sending anybody a bill.
 *
 *   npm run preview:statement
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildStatement, buildStatementPdf } from "../src/lib/statement";
import { sampleInvoices } from "../src/lib/data/sample-admin";

const DIR = resolve(process.cwd(), ".email-preview");
mkdirSync(DIR, { recursive: true });

const year = new Date().getFullYear();

const statement = buildStatement({
  name: "Joel Ferrand",
  from: `${year}-01-01`,
  to: `${year}-12-31`,
  invoices: sampleInvoices,
  payments: sampleInvoices.slice(0, 3).map((inv, i) => ({
    id: `p${i}`,
    invoice_id: inv.id,
    amount_cents: inv.amount_cents + inv.tax_cents,
    paid_at: `${inv.due_date}T10:00:00Z`,
    method: i === 0 ? "etransfer" : "cheque",
  })),
});

const pdf = await buildStatementPdf(statement, "Room Within Community");
const out = resolve(DIR, "statement.pdf");
writeFileSync(out, pdf);

console.log(`\n  ${statement.entries.length} lines, balance ${(statement.balanceCents / 100).toFixed(2)}`);
console.log(`  Written to ${out}\n`);
