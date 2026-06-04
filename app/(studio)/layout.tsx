import { notFound } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { STUDIO_ENABLED } from "@/lib/studio/enabled";

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  if (!STUDIO_ENABLED) {
    notFound();
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar />
      <main className="flex-1">{children}</main>
    </div>
  );
}
