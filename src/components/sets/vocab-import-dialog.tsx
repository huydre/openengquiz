"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { CardInput } from "@/lib/vocab/card-schema";
import { VocabImport } from "./vocab-import";

/** "Nhập" button that opens the vocabulary import in a modal. */
export function VocabImportDialog({ setId, onCards, label = "Nhập" }: {
  setId?: string;
  onCards?: (cards: CardInput[]) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <FileSpreadsheet aria-hidden="true" /> {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card max-h-[90vh] overflow-y-auto rounded-3xl border-2 p-5 sm:max-w-3xl sm:p-6">
          <DialogTitle className="text-2xl font-black">Nhập từ vựng</DialogTitle>
          <DialogDescription className="sr-only">Tải file Excel, CSV hoặc dán danh sách từ.</DialogDescription>
          <VocabImport
            bare
            setId={setId}
            onCards={onCards ? (cards) => { onCards(cards); setOpen(false); } : undefined}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
