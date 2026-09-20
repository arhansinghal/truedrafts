import { Text, Section, Hr, Button } from "@react-email/components";
import { BaseEmail } from "./_base";

const BLUE = "#0851A0";
const INK = "#111827";
const MUTED = "#6b7280";

export type DigestEmailMatch = {
  slug: string;
  title: string;
  universityName: string;
  admittedYear: number | null;
  priceLabel: string;
};

export type DigestEmailSection = {
  name: string;
  description: string;
  href: string;
  matches: DigestEmailMatch[];
};

/**
 * "New matches for your saved searches" — one email per reader, one block per
 * saved search.
 */
export default function SavedSearchDigestEmail({
  name,
  sections,
  totalMatches,
  appUrl,
  manageUrl,
}: {
  name: string;
  sections: DigestEmailSection[];
  totalMatches: number;
  appUrl: string;
  manageUrl: string;
}) {
  const firstName = name.split(" ")[0] || "there";
  const noun = totalMatches === 1 ? "application" : "applications";

  return (
    <BaseEmail
      preview={`${totalMatches} new ${noun} matching your saved ${
        sections.length === 1 ? "search" : "searches"
      }`}
    >
      <Text style={{ margin: 0, fontSize: 20, fontWeight: 700, color: INK }}>
        {totalMatches} new {noun} for you
      </Text>
      <Text style={{ margin: "8px 0 0", fontSize: 14, color: MUTED }}>
        Hi {firstName} — here&apos;s what went live since your last digest.
      </Text>

      {sections.map((section, index) => (
        <Section key={section.name + index} style={{ marginTop: 24 }}>
          <Text
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 700,
              color: INK,
              textTransform: "uppercase" as const,
              letterSpacing: "0.04em",
            }}
          >
            {section.name}
          </Text>
          <Text style={{ margin: "2px 0 12px", fontSize: 12, color: MUTED }}>
            {section.description}
          </Text>

          {section.matches.map((match) => (
            <Section
              key={match.slug}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: "12px 14px",
                marginBottom: 8,
              }}
            >
              <a
                href={`${appUrl}/applications/${match.slug}`}
                style={{
                  color: INK,
                  fontSize: 15,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                {match.title}
              </a>
              <Text style={{ margin: "3px 0 0", fontSize: 12, color: MUTED }}>
                {match.universityName}
                {match.admittedYear ? ` · Class of ${match.admittedYear}` : ""} ·{" "}
                {match.priceLabel}
              </Text>
            </Section>
          ))}

          <a
            href={`${appUrl}${section.href}`}
            style={{ fontSize: 12, color: BLUE, textDecoration: "none" }}
          >
            See everything matching “{section.name}” →
          </a>
        </Section>
      ))}

      <Section style={{ marginTop: 28, textAlign: "center" as const }}>
        <Button
          href={`${appUrl}/applications`}
          style={{
            backgroundColor: BLUE,
            color: "#ffffff",
            borderRadius: 8,
            padding: "11px 22px",
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Browse all applications
        </Button>
      </Section>

      <Hr style={{ borderColor: "#f3f4f6", margin: "24px 0 12px" }} />
      <Text style={{ margin: 0, fontSize: 11, color: MUTED }}>
        You asked for these updates when you saved a search.{" "}
        <a href={manageUrl} style={{ color: BLUE }}>
          Change how often you hear from us
        </a>
        , or turn them off entirely.
      </Text>
    </BaseEmail>
  );
}
