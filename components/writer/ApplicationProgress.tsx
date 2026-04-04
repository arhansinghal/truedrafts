import { Progress } from "@/components/ui/progress";
import Image from "next/image";
import type { University } from "@/lib/db/schema";

interface WriterUniProgress {
  university: University;
  applicationProgress: number;
  admittedYear: number | null;
  verifiedAdmit: boolean;
}

export function ApplicationProgress({ unis }: { unis: WriterUniProgress[] }) {
  if (unis.length === 0) {
    return (
      <p className="text-sm text-gray-400">No universities added yet. Update your profile to add them.</p>
    );
  }

  return (
    <div className="space-y-4">
      {unis.map((wu) => (
        <div key={wu.university.id} className="flex items-center gap-4">
          {wu.university.logoUrl ? (
            <Image
              src={wu.university.logoUrl}
              alt={wu.university.name}
              width={32}
              height={32}
              className="rounded-sm object-contain shrink-0"
            />
          ) : (
            <div className="h-8 w-8 rounded-sm bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
              {wu.university.name[0]}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700 truncate">
                {wu.university.name}
                {wu.admittedYear && (
                  <span className="text-gray-400 font-normal ml-1">· {wu.admittedYear}</span>
                )}
              </span>
              <span className="text-xs text-gray-500 shrink-0 ml-2">{wu.applicationProgress}%</span>
            </div>
            <Progress value={wu.applicationProgress} className="h-1.5" />
          </div>
        </div>
      ))}
    </div>
  );
}
