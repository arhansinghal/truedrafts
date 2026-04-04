import Image from "next/image";
import { formatCents, timeAgo } from "@/lib/utils";

interface BuyerEntry {
  id: string;
  buyerName: string;
  buyerEmail: string;
  essayTitle: string;
  uniName: string;
  uniLogo: string | null;
  uniSlug?: string;
  amountCents: number;
  writerPayoutCents: number;
  purchasedAt: Date | string | null;
}

export function BuyersList({ buyers }: { buyers: BuyerEntry[] }) {
  if (buyers.length === 0) {
    return <p className="text-sm text-gray-400">No buyers yet. Once your applications are purchased, they&apos;ll appear here.</p>;
  }

  return (
    <div className="space-y-3">
      {buyers.map((b) => (
        <div key={b.id} className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          {/* Uni logo */}
          <div className="h-9 w-9 rounded-lg border border-gray-100 flex items-center justify-center overflow-hidden bg-white shrink-0">
            {b.uniSlug ? (
              <Image src={`/uni_logos/${b.uniSlug}.png`} alt={b.uniName} width={28} height={28} className="object-contain" unoptimized />
            ) : (
              <div className="h-9 w-9 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">{b.uniName[0]}</div>
            )}
          </div>

          {/* Buyer info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{b.buyerName}</p>
            <a href={`mailto:${b.buyerEmail}`} className="text-xs text-[#0851A0] hover:underline truncate block">{b.buyerEmail}</a>
            <p className="text-xs text-gray-500 truncate mt-0.5">
              {b.essayTitle} · {b.uniName}
            </p>
          </div>

          {/* Payout + time + contact */}
          <div className="text-right shrink-0 flex flex-col items-end gap-1">
            <p className="text-sm font-semibold text-green-600">+{formatCents(b.writerPayoutCents)}</p>
            <p className="text-xs text-gray-400">{timeAgo(b.purchasedAt)}</p>
            <a
              href={`mailto:${b.buyerEmail}`}
              className="mt-1 text-xs border border-gray-300 rounded px-2 py-0.5 text-gray-600 hover:bg-gray-50"
            >
              Contact
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
