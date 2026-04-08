import { Text, Section } from "@react-email/components";
import { BaseEmail, STYLES } from "./_base";

interface Props {
  name: string;
  verifyUrl: string;
}

export default function VerifyEmailEmail({ name, verifyUrl }: Props) {
  return (
    <BaseEmail preview="One click to verify your email and unlock TrueDrafts.">
      <Text style={STYLES.h1}>Verify your email address</Text>
      <Text style={STYLES.body}>Hi {name},</Text>
      <Text style={STYLES.body}>
        Welcome to TrueDrafts! Verify your email to get full access to the marketplace — browsing, purchasing, and connecting with admitted students.
      </Text>

      <Section style={{ textAlign: "center" as const, margin: "28px 0" }}>
        <a href={verifyUrl} style={STYLES.btn}>Verify Email →</a>
      </Section>

      <Section style={STYLES.callout}>
        <Text style={STYLES.calloutText}>This link expires in 24 hours.</Text>
      </Section>

      <Text style={STYLES.muted}>
        If you didn't create a TrueDrafts account, you can safely ignore this email.
      </Text>
    </BaseEmail>
  );
}
