import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { SetForm } from "../set-form";

export const metadata = { title: "Tạo bộ từ" };

export default function NewSetPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-black">Tạo bộ từ</h1>
        <Link href="/sets/new/ai" className={buttonVariants({ variant: "outline" })}>
          Tạo thẻ bằng AI
        </Link>
      </div>
      <SetForm />
    </div>
  );
}
