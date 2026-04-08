import { Text, Section } from "@react-email/components";
import { BaseEmail, STYLES } from "./_base";

interface Props {
  writerName: string;
  appTitle: string;
  reason: string;
  editUrl: string;
}

export default function ApplicationRejectedEmail({
  writerName,
  appTitle,
  reason,
  editUrl,
}: Props) {
  return (
    <BaseEmail preview={`Action needed: ${appTitle} wasn't approved — here's what to fix.`}>
      <Text style={STYLES.h1}>Action needed on your submission</Text>
      <Text style={STYLES.body}>Hi {writerName},</Text>
      <Text style={STYLES.body}>
        After review, <strong>{appTitle}</strong> wasn't approved for the marketplace. Here's the specific reason from our team:
      </Text>

      <Section style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "16px 20px", margin: "20px 0" }}>
        <Text style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>
          Reason for rejection
        </Text>
        <Text style={{ margin: 0, fontSize: 15, color: "#991b1b", lineHeight: "1.6" }}>
          {reason}
        </Text>
      </Section>

      <Text style={{ ...STYLES.body, fontWeight: 600, color: "#111827" }}>What to do next:</Text>
      <Text style={{ ...STYLES.body, margin: "0 0 6px" }}>1. Review the feedback above</Text>
      <Text style={{ ...STYLES.body, margin: "0 0 6px" }}>2. Edit your submission from your writer dashboard</Text>
      <Text style={STYLES.body}>3. Resubmit — our team reviews within 48 hours</Text>

      <Section style={STYLES.callout}>
        <Text style={STYLES.calloutText}>
          Most rejections are fixable. Common issues: missing essay content, placeholder text, or screenshots instead of typed essays.
        </Text>
      </Section>

      <Section style={{ textAlign: "center" as const, margin: "28px 0" }}>
        <a href={editUrl} style={STYLES.btn}>Edit & Resubmit →</a>
      </Section>

      <Text style={STYLES.muted}>
        If you have questions about this decision, email us at{" "}
        <a href="mailto:team@truedrafts.com" style={{ color: STYLES.blue }}>team@truedrafts.com</a>.
      </Text>
    </BaseEmail>
  );
}
