import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight, Clock } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Application Submitted" };

export default function SubmittedPage() {
  return (
    <div className="max-w-lg mx-auto py-12 text-center">
      {/* Success icon */}
      <div className="flex justify-center mb-6">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-[#e8f1fa] flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-[#0851A0]" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white border-2 border-[#e8f1fa] flex items-center justify-center">
            <Image src="/TD_logo.png" alt="TrueDrafts" width={18} height={18} className="object-contain" unoptimized />
          </div>
        </div>
      </div>

      {/* Heading */}
      <h1 className="font-serif text-3xl font-bold text-gray-900 mb-3">
        Application received!
      </h1>
      <p className="text-gray-500 text-base leading-relaxed mb-8 max-w-sm mx-auto">
        Thank you for submitting your application. Our team will review it within{" "}
        <span className="font-semibold text-gray-700">24–48 hours</span> and notify you by email once it goes live.
      </p>

      {/* Status card */}
      <div className="rounded-2xl border border-[#0851A0]/15 bg-[#f0f5ff] p-6 mb-8 text-left">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#0851A0]/60 mb-4">What happens next</p>
        <div className="space-y-3">
          {[
            { icon: Clock, text: "Our team reviews your essays for authenticity and quality." },
            { icon: CheckCircle, text: "You'll receive an email when your application is approved." },
            { icon: ArrowRight, text: "Once live, students can browse and purchase your full application." },
          ].map(({ icon: Icon, text }, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-[#0851A0]/10 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-3.5 h-3.5 text-[#0851A0]" />
              </div>
              <p className="text-sm text-gray-600">{text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link href="/writer/essays">
          <Button className="bg-[#0851A0] text-white hover:bg-[#063d85] gap-2 w-full sm:w-auto" style={{ background: "#0851A0" }}>
            View My Applications <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
        <Link href="/writer/essays/new">
          <Button variant="outline" className="gap-2 w-full sm:w-auto">
            Submit Another Application
          </Button>
        </Link>
      </div>
    </div>
  );
}
