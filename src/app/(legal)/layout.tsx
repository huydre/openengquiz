import Link from "next/link";

/** Shared shell for the public legal pages (privacy policy, terms). */
export default function LegalLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="bg-background min-h-screen">
      <header className="border-b-2">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-primary text-lg font-black">OpenEngQuiz</Link>
          <nav className="flex gap-4 text-sm font-bold">
            <Link href="/privacy" className="hover:underline">Bảo mật</Link>
            <Link href="/terms" className="hover:underline">Điều khoản</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 [&_h1]:mb-2 [&_h1]:text-3xl [&_h1]:font-black [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-extrabold [&_li]:ml-5 [&_li]:list-disc [&_p]:leading-relaxed [&_ul]:space-y-1.5">
        {children}
      </main>
    </div>
  );
}
