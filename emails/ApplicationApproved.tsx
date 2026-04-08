import { Text, Section } from "@react-email/components";
import { BaseEmail, STYLES } from "./_base";

interface Props {
  writerName: string;
  appTitle: string;
  university: string;
  priceDollars: string;
  viewUrl: string;
  highlight?: string | null; // Gemma-extracted compelling sentence
}

export default function ApplicationApprovedEmail({
  writerName,
  appTitle,
  university,
  priceDollars,
  viewUrl,
  highlight,
}: Props) {
  return (
    <BaseEmail preview={`Your application is live on TrueDrafts — students can now find and purchase it.`}>
      <Text style={STYLES.h1}>Your application is live ✅</Text>
      <Text style={STYLES.body}>Hi {writerName},</Text>
      <Text style={STYLES.body}>
        <strong>{appTitle}</strong> has been approved and is now live on TrueDrafts. Students browsing {university} can find and purchase your full application for <strong>${priceDollars}</strong>.
      </Text>

      {highlight && (
        <Section style={{ ...STYLES.callout, borderLeft: `3px solid ${STYLES.blue}` }}>
          <Text style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: "#6b7280", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>
            Standout moment from your essay
          </Text>
          <Text style={{ margin: 0, fontSize: 14, color: "#1e40af", fontStyle: "italic", lineHeight: "1.6" }}>
            "{highlight}"
          </Text>
        </Section>
      )}

      <Text style={STYLES.body}>
        Share your listing link to drive traffic and earn more. Every purchase puts money directly in your pocket.
      </Text>

      <Section style={{ textAlign: "center" as const, margin: "28px 0" }}>
        <a href={viewUrl} style={STYLES.btn}>View Your Listing →</a>
      </Section>

      <Text style={STYLES.muted}>
        Questions? Reply to this email or reach us at{" "}
        <a href="mailto:team@truedrafts.com" style={{ color: STYLES.blue }}>team@truedrafts.com</a>.
      </Text>
    </BaseEmail>
  );
}
