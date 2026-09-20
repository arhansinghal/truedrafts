import type { Metadata } from "next";
import { PromoCodeManager } from "@/components/admin/PromoCodeManager";

export const metadata: Metadata = { title: "Promo codes · Admin" };

// Codes change as campaigns are paused and resumed; nothing here is cacheable.
export const dynamic = "force-dynamic";

export default function AdminPromoCodesPage() {
  // The admin layout already gates on role; this page is a thin shell around
  // the client manager, which does its own fetching so create/pause/delete can
  // refresh the table without a full navigation.
  return <PromoCodeManager />;
}
