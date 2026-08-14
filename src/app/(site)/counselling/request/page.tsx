import type { Metadata } from "next";
import { CounsellingRequestForm } from "@/components/site/CounsellingRequestForm";
import { Container, Section, SectionHeading } from "@/components/ui/Section";

export const metadata: Metadata = {
  title: "Request an appointment",
  description:
    "Ask Tausha about counselling at Room Within Community, Grassy Lake, Alberta.",
};

export default function RequestPage() {
  return (
    <Section tint="cream">
      <Container>
        <SectionHeading
          eyebrow="Counselling"
          title="Get in touch with"
          script="Tausha"
          lead="Fill in as much or as little as you like. It comes straight to Tausha and nobody else sees it."
        />

        <div className="mx-auto mt-12 max-w-2xl rounded-[var(--radius-card)] border border-tan/25 bg-parchment/40 p-6 sm:p-8">
          <CounsellingRequestForm />
        </div>
      </Container>
    </Section>
  );
}
