import type { Metadata } from "next";
import { AuditLogTable } from "@/components/admin/AuditLogTable";

export const metadata: Metadata = { title: "Audit log · Admin" };

export const dynamic = "force-dynamic";

export default function AdminAuditPage() {
  // The admin layout gates on role. The table fetches its own pages so
  // filtering and paging don't need a navigation.
  return <AuditLogTable />;
}
