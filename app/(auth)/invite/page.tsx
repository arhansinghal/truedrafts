import Link from "next/link";
import { Mail, Wallet, Clock, ShieldCheck } from "lucide-react";
import { AcceptInviteButton } from "@/components/invite/AcceptInviteButton";

export const metadata = {
  title: "You're invited to share your essays",
  description:
    "You've been invited to share your college application essays on TrueDrafts and earn every time a student unlocks them.",
};

const BENEFITS = [
  {
    icon: Wallet,
    title: "Earn on every unlock",
    body: "Set your own price. Get paid each time a student unlocks your application.",
  },
  {
    icon: Clock,
    title: "Takes about 5 minutes",
    body: "Upload your Common App PDF — we read it and pre-fill everything for you.",
  },
  {
    icon: ShieldCheck,
    title: "You stay anonymous",
    body: "Your name is never shown publicly. Verified admits only.",
  },
];

export default function InvitePage() {
  return (
    <div className="w-full max-w-[480px]">
      <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/70 border border-slate-100 overflow-hidden">
        {/* Top accent */}
        <div className="h-1.5 bg-[#0851A0]" />

        <div className="px-8 py-9">
          {/* Invite badge */}
          <div className="flex items-center gap-1.5 bg-[#e8f1fa] border border-blue-100 rounded-full px-3 py-1 w-fit">
            <Mail className="h-3.5 w-3.5 text-[#0851A0]" />
            <span className="text-xs font-semibold text-[#0851A0] tracking-wide">You're invited</span>
          </div>

          {/* Headline */}
          <h1 className="mt-5 font-serif text-3xl font-bold text-gray-900 tracking-tight leading-[1.15]">
            Share your essays.
            <br />
            Earn from your admit.
          </h1>
          <p className="mt-3 text-sm text-gray-500 leading-relaxed">
            Your essays got you in — now they can help the next student and earn you money every
            time someone unlocks your application. Accept your invite to set up your writer profile.
          </p>

          {/* Benefits */}
          <ul className="mt-7 space-y-4">
            {BENEFITS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex items-start gap-3.5">
                <div className="flex-shrink-0 w-10 h-10 bg-[#e8f1fa] rounded-xl flex items-center justify-center">
                  <Icon className="h-5 w-5 text-[#0851A0]" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{body}</p>
                </div>
              </li>
            ))}
          </ul>

          {/* Accept */}
          <div className="mt-8">
            <AcceptInviteButton />
            <p className="mt-3 text-center text-xs text-gray-400 leading-relaxed">
              Nothing is shared until you choose to publish. By accepting you agree to our{" "}
              <Link href="/terms" className="underline hover:text-gray-600">Terms</Link>{" "}and{" "}
              <Link href="/privacy" className="underline hover:text-gray-600">Privacy Policy</Link>.
            </p>
          </div>
        </div>

        {/* Decline / alt path */}
        <div className="border-t border-slate-100 bg-slate-50/60 px-8 py-4 text-center">
          <p className="text-sm text-gray-500">
            Just here to read?{" "}
            <Link href="/applications" className="text-[#0851A0] font-semibold hover:underline">
              Browse essays instead
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
