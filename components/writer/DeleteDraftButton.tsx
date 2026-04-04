"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export function DeleteDraftButton({ draftId }: { draftId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  async function handleDelete() {
    await fetch(`/api/writer/drafts/${draftId}`, { method: "DELETE" });
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-500">Delete?</span>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} className="text-xs px-2 h-7">No</Button>
        <Button size="sm" variant="ghost" onClick={handleDelete} className="text-xs px-2 h-7 text-red-500 hover:text-red-600">Yes</Button>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => setConfirming(true)}
      className="text-gray-400 hover:text-red-500 w-8 h-8 p-0"
    >
      <Trash2 className="w-4 h-4" />
    </Button>
  );
}
