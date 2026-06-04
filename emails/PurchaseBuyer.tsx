import { Text, Section, Hr } from "@react-email/components";
import { BaseEmail, STYLES } from "./_base";

interface Props {
  buyerName: string;
  appTitle: string;
  university: string;
  priceLabel: string;
  viewUrl: string;
  writerEmail?: string;
}

export default function PurchaseBuyerEmail({
  buyerName,
  appTitle,
  university,
  priceLabel,
  viewUrl,
  writerEmail,
}: Props) {
  return (
    <BaseEmail preview={`You unlocked ${appTitle} — view it any time in your library.`}>
      <Text style={STYLES.h1}>Application unlocked ✓</Text>
      <Text style={STYLES.body}>Hi {buyerName},</Text>
      <Text style={STYLES.body}>
        You now have permanent access to{" "}
        <strong>{appTitle}</strong> — a full application from an admitted student at {university}.
      </Text>

      {/* Receipt */}
      <Section style={{ backgroundColor: "#f9fafb", borderRadius: 10, padding: "18px 20px", margin: "20px 0" }}>
        <Text style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>Receipt</Text>
        <Section>
          <Text style={{ margin: "0 0 4px", fontSize: 14, color: "#374151", display: "flex" as const, justifyContent: "space-between" as const }}>
            <span>{appTitle}</span>
          </Text>
          <Text style={{ margin: "0 0 4px", fontSize: 13, color: "#6b7280" }}>{university}</Text>
        </Section>
        <Hr style={{ borderColor: "#e5e7eb", margin: "12px 0" }} />
        <Text style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>
          Total paid: {priceLabel}
        </Text>
      </Section>

      {writerEmail && (
        <Section style={STYLES.callout}>
          <Text style={STYLES.calloutText}>
            Writer contact:{" "}
            <a href={`mailto:${writerEmail}`} style={{ color: STYLES.blue }}>{writerEmail}</a>
            {" "}— feel free to reach out with questions.
          </Text>
        </Section>
      )}

      <Section style={{ textAlign: "center" as const, margin: "28px 0" }}>
        <a href={viewUrl} style={STYLES.btn}>View in Library →</a>
      </Section>

      <Text style={STYLES.muted}>
        This purchase gives you lifetime access. Find this essay any time under My Library on your dashboard.
      </Text>
    </BaseEmail>
  );
}
