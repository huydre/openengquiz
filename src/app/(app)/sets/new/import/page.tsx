import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { VocabImport } from "@/components/sets/vocab-import";

export const metadata = { title: "Nhập bộ từ" };

export default function ImportSetPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/sets/new" aria-label="Quay lại tạo bộ từ" className="hover:bg-muted grid size-10 place-items-center rounded-full">
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
        <h1 className="text-3xl font-black">Nhập bộ từ</h1>
      </div>
      <VocabImport />
    </div>
  );
}
