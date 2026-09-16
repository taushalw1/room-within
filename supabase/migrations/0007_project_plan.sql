-- ---------------------------------------------------------------------------
-- The project plan, and the rest of the funding pipeline.
--
-- Tausha built a sixteen-sheet workbook for the building purchase: a task
-- register, five phase gates, and ten funding sources she had already
-- researched. A spreadsheet nobody opens is worth nothing, so the parts that
-- belong beside the day-to-day work move into the app.
--
-- The three tables here and the seed data below were generated from that
-- workbook rather than retyped, so nothing was lost or mistyped in transit.
-- Everything is admin-only.
-- ---------------------------------------------------------------------------

-- --- What the funding pipeline needs that grants didn't have ------------------

alter table public.opportunities
  add column if not exists probability integer
    check (probability is null or probability between 0 and 100),
  add column if not exists owner text,
  add column if not exists next_action text,
  -- Some funding is a rolling intake or "negotiated with purchase" rather than
  -- a date. A sentence is more honest than a made-up deadline.
  add column if not exists deadline_note text;

comment on column public.opportunities.probability is
  'Her own estimate of the chance of getting it, 0-100. Used for a weighted total.';

-- --- Phase gates --------------------------------------------------------------

-- A gate is a decision that must not be taken until its conditions are true.
-- The point of writing them down is to make skipping one a deliberate act
-- rather than a drift.
create table if not exists public.project_gates (
  id              uuid primary key default gen_random_uuid(),
  position        integer not null unique,
  decision        text not null,
  conditions      text not null,
  owner           text,
  evidence        text,
  target_on       date,
  status          text not null default 'not_started'
                    check (status in ('not_started', 'in_progress', 'passed')),
  risk_if_skipped text,
  passed_on       date,
  notes           text,
  created_at      timestamptz not null default now()
);

-- --- The task register --------------------------------------------------------

create table if not exists public.project_tasks (
  id           uuid primary key default gen_random_uuid(),
  ref          text unique,
  phase        text not null,
  workstream   text,
  title        text not null,
  why          text,
  owner        text,
  priority     text not null default 'medium'
                 check (priority in ('critical', 'high', 'medium', 'low')),
  status       text not null default 'todo'
                 check (status in ('todo', 'doing', 'blocked', 'done')),
  starts_on    date,
  due_on       date,
  dependency   text,
  next_action  text,
  notes        text,
  done_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists project_tasks_phase_idx
  on public.project_tasks (phase, status);
create index if not exists project_tasks_due_idx
  on public.project_tasks (due_on) where due_on is not null;

-- --- Row level security -------------------------------------------------------

alter table public.project_gates enable row level security;
alter table public.project_tasks enable row level security;

do $$
declare t text;
begin
  foreach t in array array['project_gates', 'project_tasks'] loop
    execute format('drop policy if exists admin_all on public.%I', t);
    execute format(
      'create policy admin_all on public.%I for all
         using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- --- Seed: the five phase gates -----------------------------------------------

insert into public.project_gates
  (position, decision, conditions, owner, evidence, target_on, status, risk_if_skipped)
values
  (1, 'Proceed with purchase', 'Conditional agreement; acceptable inspection; written zoning/use path; financing plan; working-capital reserve', 'Tausha + Finance + Property', 'Property & Approvals / Capital Budget', '2026-09-15'::date, 'in_progress', 'Buying a building that cannot be legally or affordably used'),
  (2, 'Begin major renovations', 'Permits issued; stamped scope; at least 3 quotes; 15–20% contingency; signed funding', 'Property Lead', 'Property & Approvals', '2026-11-30'::date, 'not_started', 'Cost overruns, rework, permit delays'),
  (3, 'Launch public programs', 'Approved occupancy; liability coverage; program lead; minimum enrollment; safeguarding and cancellation process', 'Program Lead', 'Program Calendar', '2027-01-15'::date, 'not_started', 'Burnout, poor attendance, insurance exposure'),
  (4, 'Launch wellness clinic pilot', '3 providers committed; provider credentials/insurance verified; privacy and room-use policies; 70% of basic fit-out funded', 'Wellness Lead', 'Wellness Clinic', '2027-04-01'::date, 'not_started', 'Overbuilding for unproven demand'),
  (5, 'Construct expansion', '6 months positive operating cash flow; demand evidence; permits; 80% funding committed; reserve remains intact', 'Board / Owners', 'Expansion Estimator', '2028-01-01'::date, 'not_started', 'Debt pressure and unfinished construction')
on conflict (position) do nothing;

-- --- Seed: the task register --------------------------------------------------

insert into public.project_tasks
  (ref, phase, workstream, title, why, owner, priority, starts_on, due_on, dependency, next_action)
values
  ('RW-001', '0 Foundation', 'Governance', 'Confirm the legal/operating structure for property ownership, programs and grant eligibility.', 'Structure affects financing, liability, taxes and which grants can be used.', 'Finance Lead', 'critical', '2026-07-20'::date, '2026-08-14'::date, 'Accountant and lawyer', 'Book joint structure review.'),
  ('RW-002', '0 Foundation', 'Leadership', 'Create a four-person project cabinet with named decision rights.', 'People who want to help need owned lanes rather than vague volunteering.', 'Tausha', 'critical', '2026-07-20'::date, '2026-08-14'::date, 'None', 'Invite property, finance/grants, programs and community leads.'),
  ('RW-003', '0 Foundation', 'Records', 'Set up shared folders and a decision log.', 'Prevents lost quotes, repeated work and unclear decisions.', 'Operations Lead', 'high', '2026-07-20'::date, '2026-07-31'::date, 'None', 'Create folder structure matching workbook tabs.'),
  ('RW-004', '1 Secure Property', 'Purchase', 'Negotiate a conditional purchase agreement or option.', 'Control the property while preserving the right to exit if approvals or financing fail.', 'External Professional', 'critical', '2026-07-20'::date, '2026-08-07'::date, 'Seller cooperation', 'Engage Alberta real-estate lawyer.'),
  ('RW-005', '1 Secure Property', 'Due Diligence', 'Complete title, tax, lien and survey review.', 'Confirms what is being purchased and any encumbrances.', 'External Professional', 'critical', '2026-08-01'::date, '2026-08-21'::date, 'Property documents', 'Request current title and Real Property Report.'),
  ('RW-006', '1 Secure Property', 'Due Diligence', 'Complete building condition and structural review.', 'Old buildings can have hidden structural and envelope costs.', 'Property Lead', 'critical', '2026-08-01'::date, '2026-08-21'::date, 'Building access', 'Get written scopes and quotes.'),
  ('RW-007', '1 Secure Property', 'Due Diligence', 'Assess asbestos/environmental risk before disturbing materials.', 'Protects health, budget and schedule.', 'Property Lead', 'critical', '2026-08-01'::date, '2026-08-21'::date, 'Building access', 'Request hazardous-material assessment.'),
  ('RW-008', '1 Secure Property', 'Finance', 'Verify current rent roll, leases and payment history.', 'Current income is central to acquisition viability.', 'Finance Lead', 'critical', '2026-07-27'::date, '2026-08-14'::date, 'Seller records', 'Obtain 12 months statements and agreements.'),
  ('RW-009', '1 Secure Property', 'Insurance', 'Obtain insurance indications for current and proposed uses.', 'Some uses or building conditions may change cost or insurability.', 'Finance Lead', 'high', '2026-07-27'::date, '2026-08-14'::date, 'Building details', 'Send use summary to commercial broker.'),
  ('RW-010', '2 Approvals & Design', 'Municipal', 'Hold MD of Taber pre-application meeting.', 'A written approval path should come before final purchase or major design spending.', 'Tausha', 'critical', '2026-07-20'::date, '2026-07-31'::date, 'Concept summary', 'Call planning staff and request meeting.'),
  ('RW-011', '2 Approvals & Design', 'Municipal', 'Confirm current land-use district and permitted/discretionary uses.', 'Determines whether change of use, discretionary approval or bylaw amendment may be needed.', 'Property Lead', 'critical', '2026-07-20'::date, '2026-08-07'::date, 'Property legal description', 'Ask MD to confirm in writing.'),
  ('RW-012', '2 Approvals & Design', 'Code', 'Commission a code analysis for phased mixed use.', 'Identifies occupancy, exits, fire separation, accessibility, washrooms and parking impacts.', 'External Professional', 'critical', '2026-08-10'::date, '2026-09-04'::date, 'Municipal path', 'Engage architect/code consultant.'),
  ('RW-013', '2 Approvals & Design', 'Design', 'Create a Phase 1 plan that prioritizes safe revenue-producing space.', 'Allows a lean opening before full renovation.', 'Property Lead', 'high', '2026-08-24'::date, '2026-09-18'::date, 'Code analysis', 'Map existing rooms to approved uses.'),
  ('RW-014', '3 Funding Readiness', 'Community Evidence', 'Complete 12 stakeholder interviews and a community survey.', 'Grant and investor cases need demonstrated need, not only vision.', 'Community Lead', 'high', '2026-08-03'::date, '2026-08-28'::date, 'Survey questions', 'Interview mothers, providers, school/FCSS and businesses.'),
  ('RW-015', '3 Funding Readiness', 'Grants', 'Confirm entity eligibility for BCSF, CFEP and CIP.', 'Most listed grants require an incorporated non-profit and public benefit.', 'Grant Lead', 'critical', '2026-07-27'::date, '2026-08-14'::date, 'Structure direction', 'Create eligibility memo.'),
  ('RW-016', '3 Funding Readiness', 'Grants', 'Build a matched-funding and in-kind contribution plan.', 'Major grants usually require leverage and proof of financial capacity.', 'Grant Lead', 'high', '2026-08-10'::date, '2026-09-04'::date, 'Capital budget', 'List cash, donations, labour, materials and confirmed sources.'),
  ('RW-017', '3 Funding Readiness', 'Investor', 'Prepare lender/investor package.', 'External capital needs a clear use of funds, security, risk and repayment path.', 'Finance Lead', 'high', '2026-08-24'::date, '2026-09-18'::date, 'Budget and cash flow', 'Draft ten-page package.'),
  ('RW-018', '4 Stabilize Revenue', 'Tenancy', 'Define office rental offer and secure expressions of interest.', 'Office tenants can stabilize the building before programming expands.', 'Operations Lead', 'high', '2026-09-01'::date, '2026-10-02'::date, 'Approved use and rooms', 'Create one-page tenant offer.'),
  ('RW-019', '4 Stabilize Revenue', 'Operations', 'Set up leases, deposits, booking, payment and cleaning systems.', 'Predictable systems reduce workload and conflict.', 'Operations Lead', 'medium', '2026-09-14'::date, '2026-10-16'::date, 'Entity and insurance', 'Select simple software and templates.'),
  ('RW-020', '5 Program Pilot', 'Programming', 'Choose three anchor programs for Year 1.', 'Focus creates reliable rhythms without overloading the organization.', 'Program Lead', 'high', '2026-08-24'::date, '2026-09-18'::date, 'Community evidence', 'Choose weekly, monthly and cohort anchors.'),
  ('RW-021', '5 Program Pilot', 'Programming', 'Build a standard program budget and go/no-go rule.', 'Programs should not quietly drain the building.', 'Program Lead', 'high', '2026-09-01'::date, '2026-09-25'::date, 'Anchor programs', 'Set minimum enrollment and contribution margin.'),
  ('RW-022', '6 Wellness Clinic Pilot', 'Provider Recruitment', 'Interview potential practitioners and collect space requirements.', 'Tests local demand before clinic construction.', 'Wellness Lead', 'high', '2026-09-01'::date, '2026-10-09'::date, 'Provider list', 'Interview 6–10 practitioners.'),
  ('RW-023', '6 Wellness Clinic Pilot', 'Compliance', 'Create provider credential, insurance and room-use checklist.', 'The centre must verify appropriate professional and insurance standards.', 'Wellness Lead', 'critical', '2026-09-14'::date, '2026-10-23'::date, 'Service mix', 'Draft checklist by profession.'),
  ('RW-024', '7 Expansion', 'Expansion', 'Define objective expansion triggers and a conceptual size.', 'Prevents emotional expansion before cash flow and demand support it.', 'Property Lead', 'medium', '2026-10-01'::date, '2026-11-30'::date, 'Operational data', 'Use Expansion Estimator and phase gates.')
on conflict (ref) do nothing;

-- --- Seed: the funding pipeline she had already researched --------------------
--
-- Marked as hers, not as something a machine found, and pre-verified: she read
-- these pages herself. The weekly search uses the same fingerprint shape, so it
-- cannot add a second copy of any of them.

insert into public.opportunities
  (kind, title, organisation, url, summary, why_relevant, eligibility,
   amount_max_cents, deadline_note, status, owner, next_action, probability,
   covers_travel, source, confidence, verified_at, fingerprint)
values
  ('grant', 'Build Communities Strong Fund — Local Impact', 'Federal capital grant', 'https://www.canada.ca/en/prairies-economic-development/services/funding/build-communities-strong-fund.html', 'Federal capital grant. Strong for public community hub and small-business support; do not frame primarily as a medical community health centre.', 'Strong for public community hub and small-business support; do not frame primarily as a medical community health centre.', 'Incorporated non-profit or local government — Normally $250k–$1M; public access; shovel-ready; strong leverage; rural projects may receive preference.', 100000000, 'Open / current intake', 'interested', 'Grant Lead', 'Request fit call with PrairiesCan; prepare public-benefit and economic-impact case.', 25, false, 'manual', 'high', now(), 'grant:canada.ca:build-communities-strong-fund-local-impact'),
  ('grant', 'CFEP Small', 'Provincial capital grant', 'https://www.alberta.ca/community-facility-enhancement-program-small', 'Provincial capital grant. Strong for public-use purchase, renovation, expansion, design or equipment.', 'Strong for public-use purchase, renovation, expansion, design or equipment.', 'Eligible Alberta non-profit/charity — One-to-one matching; for-profits ineligible; private/restricted facilities ineligible.', 12500000, 'Deadlines Jan 15, May 15, Sep 15', 'interested', 'Grant Lead', 'Confirm entity and public-use structure; build match inventory.', 35, false, 'manual', 'high', now(), 'grant:alberta.ca:cfep-small'),
  ('grant', 'CFEP Large', 'Provincial capital grant', 'https://www.alberta.ca/community-facility-enhancement-program-large', 'Provincial capital grant. Potential future fit for large renovation/expansion.', 'Potential future fit for large renovation/expansion.', 'Non-profit registered at least 2 years — Two-step process; public-use; organizational capacity and viability heavily assessed.', 100000000, 'EOI generally May 15; invited application follows', 'new', 'Grant Lead', 'Treat as later-stage after governance, track record and project readiness improve.', 15, false, 'manual', 'high', now(), 'grant:alberta.ca:cfep-large'),
  ('grant', 'CIP Project Grant', 'Provincial program grant', 'https://www.alberta.ca/cip-project-grant', 'Provincial program grant. Good for community programs, events, technology and portable equipment—not building purchase.', 'Good for community programs, events, technology and portable equipment—not building purchase.', 'Eligible non-profit operational at least one year — Requires eligible non-profit; new programs should not start before submission.', 7500000, 'Next one-time deadline Sep 1, 2026; then Feb 15 / Aug 15', 'interested', 'Grant Lead', 'Decide quickly whether Room Within or a qualified partner can apply.', 30, false, 'manual', 'high', now(), 'grant:alberta.ca:cip-project-grant'),
  ('grant', 'Community donations / founding circle', 'Donation', null, 'Donation. Good for match, furniture, visible community components and predevelopment.', 'Good for match, furniture, visible community components and predevelopment.', 'Non-profit or documented campaign partner — Needs clear public purpose, receipts structure and transparent campaign.', 5000000, 'Rolling', 'new', 'Community Lead', 'Create founding-circle case and naming/recognition policy.', 40, false, 'manual', 'high', now(), 'grant::community-donations-founding-circle'),
  ('grant', 'Local business sponsorship', 'Sponsorship', null, 'Sponsorship. Good for rooms, programs, equipment and launch events.', 'Good for rooms, programs, equipment and launch events.', 'Operating entity or non-profit — Must avoid overpromising naming rights or charitable receipts.', 2500000, 'Rolling', 'new', 'Community Lead', 'Build 3 sponsorship levels tied to public outcomes.', 35, false, 'manual', 'high', now(), 'grant::local-business-sponsorship'),
  ('grant', 'Vendor financing', 'Debt / seller financing', null, 'Debt / seller financing. Known potential source for remaining purchase price.', 'Known potential source for remaining purchase price.', 'Property owner — Interest rate, security, payment schedule and default terms must be documented.', 10000000, 'Negotiated with purchase', 'interested', 'Finance Lead', 'Model 5-year graduated repayment and negotiate conditions.', 70, false, 'manual', 'high', now(), 'grant::vendor-financing'),
  ('grant', 'Private investor equity / secured loan', 'Equity or debt', null, 'Equity or debt. Can bridge acquisition and code work if terms are sustainable.', 'Can bridge acquisition and code work if terms are sustainable.', 'Property entity — Needs clear security, return, governance and exit/repayment.', 15000000, 'Rolling', 'new', 'Finance Lead', 'Prepare investor package after due diligence and updated cash flow.', 30, false, 'manual', 'high', now(), 'grant::private-investor-equity-secured-loan'),
  ('grant', 'Commercial mortgage / community lender', 'Debt', null, 'Debt. Possible if value, current income and borrower capacity support it.', 'Possible if value, current income and borrower capacity support it.', 'Property entity — Debt service must fit slow-ramp scenario; lender may require equity and repairs.', 15000000, 'After appraisal and underwriting', 'new', 'Finance Lead', 'Request preliminary terms after appraisal and rent verification.', 35, false, 'manual', 'high', now(), 'grant::commercial-mortgage-community-lender'),
  ('grant', 'In-kind labour and materials', 'In-kind match', null, 'In-kind match. Useful for CFEP match if properly valued and documented.', 'Useful for CFEP match if properly valued and documented.', 'Eligible non-profit for grants — Only eligible donated resources and actual hours; records required.', 5000000, 'Project-specific', 'new', 'Grant Lead', 'Create donor forms and track skilled/unskilled/equipment categories.', 50, false, 'manual', 'high', now(), 'grant::in-kind-labour-and-materials')
on conflict (fingerprint) do nothing;
