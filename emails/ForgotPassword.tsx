import { Text, Section } from "@react-email/components";
import { BaseEmail, STYLES } from "./_base";

interface Props {
  name: string;
  resetUrl: string;
}

export default function ForgotPasswordEmail({ name, resetUrl }: Props) {
  return (
    <BaseEmail preview="Reset your TrueDrafts password — link expires in 15 minutes.">
      <Text style={STYLES.h1}>Reset your password</Text>
      <Text style={STYLES.body}>Hi {name},</Text>
      <Text style={STYLES.body}>
        We received a request to reset your TrueDrafts password. Click the button below — this link expires in <strong>15 minutes</strong>.
      </Text>

      <Section style={{ textAlign: "center" as const, margin: "28px 0" }}>
        <a href={resetUrl} style={STYLES.btn}>Reset Password →</a>
      </Section>

      <Section style={STYLES.callout}>
        <Text style={STYLES.calloutText}>Link expires at {new Date(Date.now() + 15 * 60 * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })}</Text>
      </Section>

      <Text style={STYLES.muted}>
        If you didn't request a password reset, you can safely ignore this email — your password won't change.
        If you're worried about account security, contact us at{" "}
        <a href="mailto:team@truedrafts.com" style={{ color: STYLES.blue }}>team@truedrafts.com</a>.
      </Text>
    </BaseEmail>
  );
}
