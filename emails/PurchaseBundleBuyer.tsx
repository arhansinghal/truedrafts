import { Text, Section, Hr } from "@react-email/components";
import { BaseEmail, STYLES } from "./_base";

interface Member {
  title: string;
  university: string;
  url: string;
}

interface Props {
  buyerName: string;
  bundleTitle: string;
  totalLabel: string;
  savingsLabel: string;
  members: Member[];
  libraryUrl: string;
}

export default function PurchaseBundleBuyerEmail({
  buyerName, bundleTitle, totalLabel, savingsLabel, members, libraryUrl,
}: Props) {
  return (
    <BaseEmail preview={`You unlocked ${members.length} applications in ${bundleTitle}.`}>
      <Text style={STYLES.h1}>Bundle unlocked ✓</Text>
      <Text style={STYLES.body}>Hi {buyerName},</Text>
      <Text style={STYLES.body}>
        You now have permanent access to the <strong>{bundleTitle}</strong> — {members.length} full
        college applications from admitted students.
      </Text>

      <Section style={{ backgroundColor: "#f9fafb", borderRadius: 10, padding: "18px 20px", margin: "20px 0" }}>
        <Text style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>
          Receipt
        </Text>
        <Text style={{ margin: "0 0 8px", fontSize: 14, color: "#374151" }}>{bundleTitle}</Text>
        <Hr style={{ borderColor: "#e5e7eb", margin: "8px 0" }} />
        <Text style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#111827" }}>
          Total paid: {totalLabel}
        </Text>
        <Text style={{ margin: 0, fontSize: 12, color: "#10b981", fontWeight: 600 }}>
          You saved {savingsLabel} vs. buying separately
        </Text>
      </Section>

      <Section style={{ margin: "20px 0" }}>
        <Text style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600, color: "#374151" }}>
          Your applications:
        </Text>
        {members.map((m, i) => (
          <Text key={i} style={{ margin: "0 0 6px", fontSize: 13, color: "#4b5563" }}>
            <a href={m.url} style={{ color: STYLES.blue, textDecoration: "none" }}>
              {i + 1}. {m.title}
            </a>{" "}
            <span style={{ color: "#9ca3af" }}>· {m.university}</span>
          </Text>
        ))}
      </Section>

      <Section style={{ textAlign: "center" as const, margin: "28px 0" }}>
        <a href={libraryUrl} style={STYLES.btn}>View in Library →</a>
      </Section>

      <Text style={STYLES.muted}>
        This purchase gives you lifetime access to every application in the bundle, even if writers later
        unpublish their work. All sales are final — no refunds.
      </Text>
    </BaseEmail>
  );
}
