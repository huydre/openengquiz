import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { LogoLoader } from "@/components/layout/logo-loader";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { GlobalSearch } from "@/components/search/global-search";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1">
      {/* The session lives in cookies (request-time data), so the signed-in shell streams in. */}
      <Suspense fallback={<LogoLoader className="flex-1" />}>
        <SignedInShell>{children}</SignedInShell>
      </Suspense>
    </div>
  );
}

async function SignedInShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "Bạn";

  return (
    <SidebarProvider style={{ "--sidebar-width-icon": "4.5rem" } as React.CSSProperties}>
      <AppSidebar displayName={displayName} />
      <SidebarInset>
        <header className="bg-background/90 sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-3 backdrop-blur-md">
          <SidebarTrigger aria-label="Mở hoặc thu gọn menu" />
          <div className="flex min-w-0 flex-1 px-1">
            <GlobalSearch />
          </div>
          <ThemeToggle />
        </header>
        <div className="flex-1 p-4 md:p-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
