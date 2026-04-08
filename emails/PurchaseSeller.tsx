import { Text, Section, Hr } from "@react-email/components";
import { BaseEmail, STYLES } from "./_base";

interface Props {
  writerName: string;
  appTitle: string;
  earnedDollars: string;
  totalEarnedDollars: string;
  earningsUrl: string;
}

export default function PurchaseSellerEmail({
  writerName,
  appTitle,
  earnedDollars,
  totalEarnedDollars,
  earningsUrl,
}: Props) {
  return (
    <BaseEmail preview={`+$${earnedDollars} earned — someone just bought your application.`}>
      <Text style={STYLES.h1}>You made a sale 💰</Text>
      <Text style={STYLES.body}>Hi {writerName},</Text>
      <Text style={STYLES.body}>
        Your application <strong>{appTitle}</strong> was just purchased by a student on TrueDrafts.
      </Text>

      {/* Earnings summary */}
      <Section style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "18px 20px", margin: "20px 0" }}>
        <Text style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 600, color: "#6b7280", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>
          Earnings Summary
        </Text>
        <Section>
          <Text style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, color: "#16a34a" }}>
            +${earnedDollars}
          </Text>
          <Text style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>added to your available balance</Text>
        </Section>
        <Hr style={{ borderColor: "#d1fae5", margin: "14px 0" }} />
        <Text style={{ margin: 0, fontSize: 14, color: "#374151" }}>
          Earnings to date: <strong>${totalEarnedDollars}</strong>
        </Text>
      </Section>

      <Section style={STYLES.callout}>
        <Text style={STYLES.calloutText}>
          Payouts are processed manually — request yours from your earnings dashboard once you reach $10.
        </Text>
      </Section>

      <Section style={{ textAlign: "center" as const, margin: "28px 0" }}>
        <a href={earningsUrl} style={STYLES.btn}>View Earnings →</a>
      </Section>
    </BaseEmail>
  );
}
