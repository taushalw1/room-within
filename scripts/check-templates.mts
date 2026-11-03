/**
 * Known-answer checks for filling in a saved message.
 *
 * The failure this guards against is a real email arriving at a real tenant
 * saying "Hi {{first_name}}", or worse, "Hi ,". Both read as carelessness
 * from a landlord, and neither shows up anywhere except in somebody's inbox.
 */
import {
  STARTER_TEMPLATES,
  blanksUsed,
  fill,
  previewWith,
  PLACEHOLDERS,
} from "../src/lib/templates";

let failures = 0;

function check(what: string, got: unknown, want: unknown) {
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a === b) {
    console.log(`  ok    ${what}`);
  } else {
    console.log(`  FAIL  ${what}\n          got  ${a}\n          want ${b}`);
    failures += 1;
  }
}

console.log("\nFilling in");

check(
  "a straightforward one",
  fill("Hello {{first_name}}, the rent is {{rent}}.", {
    first_name: "Sarah",
    rent: "$1,200.00",
  }),
  { text: "Hello Sarah, the rent is $1,200.00.", missing: [], unknown: [] },
);

check(
  "spaces inside the braces",
  fill("Hello {{ first_name }}.", { first_name: "Sarah" }).text,
  "Hello Sarah.",
);

check(
  "same blank twice",
  fill("{{first_name}}, hello {{first_name}}.", { first_name: "Sarah" }).text,
  "Sarah, hello Sarah.",
);

// The important ones: a blank that can't be filled stays visible.
check("nothing to put in it", fill("Hello {{first_name}}.", {}), {
  text: "Hello {{first_name}}.",
  missing: ["first_name"],
  unknown: [],
});

check("an empty string counts as missing", fill("Hello {{unit}}.", { unit: "" }), {
  text: "Hello {{unit}}.",
  missing: ["unit"],
  unknown: [],
});

check("a typo is not a blank", fill("Hello {{frist_name}}.", { first_name: "Sarah" }), {
  text: "Hello {{frist_name}}.",
  missing: [],
  unknown: ["frist_name"],
});

check(
  "each problem reported once",
  fill("{{nope}} {{nope}} {{unit}} {{unit}}", {}),
  { text: "{{nope}} {{nope}} {{unit}} {{unit}}", missing: ["unit"], unknown: ["nope"] },
);

check("nothing to fill", fill("Just a sentence.", {}), {
  text: "Just a sentence.",
  missing: [],
  unknown: [],
});

// A value that itself looks like a blank must not be filled again.
check(
  "no second pass over a filled value",
  fill("Hello {{first_name}}.", { first_name: "{{rent}}", rent: "nope" }).text,
  "Hello {{rent}}.",
);

// A dollar sign in a replacement is special to String.replace if passed
// through carelessly: "$&" means "the whole match".
check(
  "a dollar amount survives intact",
  fill("Rent is {{rent}}.", { rent: "$1,200.00" }).text,
  "Rent is $1,200.00.",
);

check(
  "and so does a literal $&",
  fill("Rent is {{rent}}.", { rent: "$& odd" }).text,
  "Rent is $& odd.",
);

console.log("\nWhich blanks a template uses");

check(
  "in first-seen order, no repeats",
  blanksUsed("{{unit}} then {{first_name}} then {{unit}}"),
  ["unit", "first_name"],
);
check("none", blanksUsed("Nothing here."), []);

console.log("\nThe starter templates");

for (const t of STARTER_TEMPLATES) {
  const subject = previewWith(t.subject);
  const body = previewWith(t.body);

  check(`"${t.name}" subject has no typos`, subject.unknown, []);
  check(`"${t.name}" body has no typos`, body.unknown, []);
  check(`"${t.name}" fills completely`, [...subject.missing, ...body.missing], []);
  // A starter nobody has to edit before sending is the point of a starter.
  check(`"${t.name}" has no leftover braces`, /\{\{/.test(body.text), false);
}

console.log("\nThe list she picks from");
check("every placeholder has an example", PLACEHOLDERS.every((p) => p.example !== ""), true);
check(
  "no duplicate keys",
  new Set(PLACEHOLDERS.map((p) => p.key)).size,
  PLACEHOLDERS.length,
);

if (failures > 0) {
  console.log(`\n${failures} check${failures === 1 ? "" : "s"} failed.\n`);
  process.exit(1);
}
console.log("\nAll template checks passed.\n");
