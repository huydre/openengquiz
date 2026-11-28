import Link from "next/link";
import { FileSpreadsheet } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { SetForm } from "../set-form";

export const metadata = { title: "Tạo bộ từ" };

export default function NewSetPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-black">Tạo bộ từ</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/sets/new/import" className={buttonVariants({ variant: "outline" })}>
            <FileSpreadsheet aria-hidden="true" /> Nhập từ file
          </Link>
          <Link href="/sets/new/ai" className={buttonVariants({ variant: "outline" })}>
            Tạo thẻ bằng AI
          </Link>
        </div>
      </div>
      <SetForm />
    </div>
  );
}
