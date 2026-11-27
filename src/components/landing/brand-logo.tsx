import Link from "next/link";
import { Languages } from "lucide-react";

/** Rounded app logo (same mark as the app sidebar) linking home. */
export function BrandLogo() {
  return (
    <Link href="/" aria-label="OpenEngQuiz trang chủ" className="flex items-center gap-2.5 rounded-2xl outline-none focus-visible:ring-2">
      <span aria-hidden="true" className="bg-primary text-primary-foreground grid size-10 place-items-center rounded-2xl shadow-[0_3px_0_var(--primary-edge)]">
        <Languages className="size-5" />
      </span>
      <span className="text-primary text-xl font-black tracking-tight">OpenEngQuiz</span>
    </Link>
  );
}
