// Shared layout shell — wrap every template in this
import {
  Html, Head, Body, Container, Section, Text, Hr, Preview,
} from "@react-email/components";
import { ReactNode } from "react";

const BLUE = "#0851A0";
const BG = "#f0f6ff";
const CARD_BG = "#ffffff";

export function BaseEmail({
  preview,
  children,
}: {
  preview: string;
  children: ReactNode;
}) {
  return (
    <Html lang="en">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={{ margin: 0, padding: 0, backgroundColor: BG, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" }}>
        <Container style={{ maxWidth: 560, margin: "40px auto", padding: "0 16px" }}>

          {/* Header */}
          <Section style={{ backgroundColor: BLUE, borderRadius: "16px 16px 0 0", padding: "22px 32px" }}>
            <Text style={{ margin: 0, color: "#ffffff", fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>
              TrueDrafts
            </Text>
            <Text style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.7)", fontSize: 12 }}>
              Real essays from real admits
            </Text>
          </Section>

          {/* Body */}
          <Section style={{ backgroundColor: CARD_BG, padding: "32px 32px 24px", borderLeft: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb" }}>
            {children}
          </Section>

          {/* Footer */}
          <Section style={{ backgroundColor: CARD_BG, borderRadius: "0 0 16px 16px", borderLeft: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb", padding: "16px 32px 24px" }}>
            <Hr style={{ borderColor: "#f3f4f6", margin: "0 0 16px" }} />
            <Text style={{ margin: 0, fontSize: 11, color: "#9ca3af", textAlign: "center" as const }}>
              TrueDrafts · College Essays from Admitted Students ·{" "}
              <a href="https://truedrafts.com" style={{ color: BLUE }}>truedrafts.com</a>
            </Text>
            <Text style={{ margin: "6px 0 0", fontSize: 11, color: "#d1d5db", textAlign: "center" as const }}>
              You're receiving this because you have an account on TrueDrafts.
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}

// Reusable styled primitives
export const STYLES = {
  blue: BLUE,
  h1: { margin: "0 0 8px", fontSize: 22, fontWeight: 700, color: "#111827", lineHeight: "1.3" } as const,
  body: { margin: "0 0 16px", fontSize: 15, color: "#4b5563", lineHeight: "1.65" } as const,
  small: { margin: "0 0 12px", fontSize: 13, color: "#6b7280", lineHeight: "1.6" } as const,
  callout: {
    backgroundColor: "#eff6ff",
    borderLeft: `3px solid ${BLUE}`,
    borderRadius: "0 8px 8px 0",
    padding: "14px 18px",
    margin: "20px 0",
  } as const,
  calloutText: { margin: 0, fontSize: 14, color: "#1e40af", fontWeight: 600 } as const,
  btn: {
    display: "inline-block",
    backgroundColor: BLUE,
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 600,
    padding: "13px 28px",
    borderRadius: 10,
    textDecoration: "none",
    marginTop: 8,
  } as const,
  muted: { margin: "20px 0 0", fontSize: 12, color: "#9ca3af", lineHeight: "1.6" } as const,
};
