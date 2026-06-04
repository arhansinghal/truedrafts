import { Text, Section } from "@react-email/components";
import { BaseEmail, STYLES } from "./_base";

interface Props {
  writerName: string;
  appTitle: string;
  bundleTitle: string;
  earnedLabel: string;
  totalEarnedLabel: string;
  earningsUrl: string;
}

export default function PurchaseBundleSellerEmail({
  writerName, appTitle, bundleTitle, earnedLabel, totalEarnedLabel, earningsUrl,
}: Props) {
  return (
    <BaseEmail preview={`+${earnedLabel} from a bundle sale of ${appTitle}.`}>
      <Text style={STYLES.h1}>Bundle sale ✓</Text>
      <Text style={STYLES.body}>Hi {writerName},</Text>
      <Text style={STYLES.body}>
        Your application <strong>{appTitle}</strong> sold as part of the{" "}
        <strong>{bundleTitle}</strong> bundle.
      </Text>

      <Section style={{ backgroundColor: "#ecfdf5", borderRadius: 10, padding: "18px 20px", margin: "20px 0" }}>
        <Text style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "#047857", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>
          Earnings (this sale)
        </Text>
        <Text style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#065f46" }}>
          +{earnedLabel}
        </Text>
        <Text style={{ margin: "6px 0 0", fontSize: 12, color: "#047857" }}>
          Total earned: {totalEarnedLabel}
        </Text>
      </Section>

      <Text style={STYLES.body}>
        Bundle proceeds are split pro-rata across the included applications based on each app's
        sticker price, at the same rate as an individual sale.
      </Text>

      <Section style={{ textAlign: "center" as const, margin: "28px 0" }}>
        <a href={earningsUrl} style={STYLES.btn}>View Earnings →</a>
      </Section>
    </BaseEmail>
  );
}
