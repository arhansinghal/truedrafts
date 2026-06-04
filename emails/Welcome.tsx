import { Text, Section } from "@react-email/components";
import { BaseEmail, STYLES } from "./_base";

interface Props {
  name: string;
  role?: string | null;
  ctaUrl: string;
}

export default function WelcomeEmail({ name, role, ctaUrl }: Props) {
  const isWriter = role === "writer";
  return (
    <BaseEmail
      preview={
        isWriter
          ? "Welcome to TrueDrafts — publish your applications and start earning."
          : "Welcome to TrueDrafts — real applications from admitted students."
      }
    >
      <Text style={STYLES.h1}>Welcome to TrueDrafts 👋</Text>
      <Text style={STYLES.body}>Hi {name},</Text>

      {isWriter ? (
        <>
          <Text style={STYLES.body}>
            Thanks for joining as a writer. You got in — now your essays can help the next applicant and earn you money along the way.
          </Text>
          <Text style={STYLES.body}>Here&apos;s how it works:</Text>
          <Section style={STYLES.callout}>
            <Text style={{ ...STYLES.calloutText, margin: "0 0 6px" }}>1 · Publish your application</Text>
            <Text style={{ ...STYLES.calloutText, margin: "0 0 6px" }}>2 · We review it within 24–48 hours</Text>
            <Text style={{ ...STYLES.calloutText, margin: 0 }}>3 · Earn every time a student unlocks it</Text>
          </Section>
          <Text style={{ textAlign: "center" as const, margin: "8px 0 4px" }}>
            <a href={ctaUrl} style={STYLES.btn}>Publish your first application</a>
          </Text>
        </>
      ) : (
        <>
          <Text style={STYLES.body}>
            Thanks for joining. TrueDrafts gives you full college applications — essays, prompts, and supplementals — from students who were actually admitted.
          </Text>
          <Text style={{ textAlign: "center" as const, margin: "8px 0 4px" }}>
            <a href={ctaUrl} style={STYLES.btn}>Browse applications</a>
          </Text>
        </>
      )}

      <Text style={STYLES.muted}>
        Questions? Just reply to this email — we read every one.
      </Text>
    </BaseEmail>
  );
}
