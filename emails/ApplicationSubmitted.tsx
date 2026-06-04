import { Text, Section } from "@react-email/components";
import { BaseEmail, STYLES } from "./_base";

interface Props {
  writerName: string;
  appTitle: string;
  university: string;
  essayCount: number;
  dashboardUrl: string;
}

export default function ApplicationSubmittedEmail({
  writerName,
  appTitle,
  university,
  essayCount,
  dashboardUrl,
}: Props) {
  return (
    <BaseEmail preview="We've received your application — it's now in review.">
      <Text style={STYLES.h1}>We&apos;ve got your application ✍️</Text>
      <Text style={STYLES.body}>Hi {writerName},</Text>
      <Text style={STYLES.body}>
        Thanks for submitting <strong>{appTitle}</strong> ({essayCount} essay{essayCount !== 1 ? "s" : ""} for {university}). It&apos;s now in our review queue.
      </Text>

      <Section style={STYLES.callout}>
        <Text style={STYLES.calloutText}>
          Our team reviews every submission within 24–48 hours. We&apos;ll email you the moment it&apos;s approved and live.
        </Text>
      </Section>

      <Text style={STYLES.body}>
        Nothing to do for now — you can track its status anytime from your dashboard.
      </Text>
      <Text style={{ textAlign: "center" as const, margin: "8px 0 4px" }}>
        <a href={dashboardUrl} style={STYLES.btn}>View your dashboard</a>
      </Text>
    </BaseEmail>
  );
}
