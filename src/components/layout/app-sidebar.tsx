"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, BookOpen, GraduationCap, History, Home, Languages, LogOut, Map, Mic, RotateCcw, Search,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { signOut } from "@/app/auth/actions";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, type NavItem } from "./nav-items";

/** Icon + colour per destination; unknown routes fall back to a neutral book icon. */
const ICONS: Record<string, { icon: LucideIcon; color: string }> = {
  "/home": { icon: Home, color: "text-primary" },
  "/sets": { icon: BookOpen, color: "text-secondary" },
  "/review": { icon: RotateCcw, color: "text-brand-orange" },
  "/paths": { icon: Map, color: "text-brand-grape" },
  "/pronunciation": { icon: Mic, color: "text-destructive" },
  "/lookup": { icon: Search, color: "text-secondary" },
  "/history": { icon: History, color: "text-brand-orange" },
  "/stats": { icon: BarChart3, color: "text-primary" },
  "/classes": { icon: GraduationCap, color: "text-brand-grape" },
};

/** Learning destinations go first; everything else is listed under "Công cụ". */
const LEARN = new Set(["/home", "/sets", "/review", "/paths", "/pronunciation"]);

const ITEM_CLASS = cn(
  "h-12 gap-3 rounded-2xl border-2 border-transparent px-3 text-sm font-extrabold tracking-wide uppercase",
  "text-sidebar-foreground [&>svg]:size-6",
  "data-[active=true]:border-primary/40 data-[active=true]:bg-sidebar-accent data-[active=true]:font-extrabold data-[active=true]:text-sidebar-accent-foreground",
  "group-data-[collapsible=icon]:size-12! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:[&>span]:hidden",
);

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function initials(name: string) {
  const parts = name.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "B").slice(0, 2)).toUpperCase();
}

function NavGroup({ label, items, pathname }: { label: string; items: NavItem[]; pathname: string }) {
  if (!items.length) return null;
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-muted-foreground px-3 text-xs font-extrabold tracking-widest uppercase">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-1 group-data-[collapsible=icon]:items-center">
          {items.map((item) => {
            const { icon: Icon, color } = ICONS[item.href] ?? { icon: BookOpen, color: "text-muted-foreground" };
            const active = isActive(pathname, item.href);
            return (
              <SidebarMenuItem key={item.href}>
                {item.comingSoon ? (
                  <>
                    <SidebarMenuButton disabled aria-disabled="true" tooltip={item.label} className={ITEM_CLASS}>
                      <Icon aria-hidden="true" className="text-muted-foreground" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                    <SidebarMenuBadge className="bg-muted text-muted-foreground top-3.5 rounded-full px-2 text-[10px] font-bold">
                      sắp có
                    </SidebarMenuBadge>
                  </>
                ) : (
                  <SidebarMenuButton asChild isActive={active} tooltip={item.label} className={ITEM_CLASS}>
                    <Link href={item.href} aria-current={active ? "page" : undefined}>
                      <Icon aria-hidden="true" className={color} />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar({ displayName }: { displayName: string }) {
  const pathname = usePathname();
  const learn = NAV_ITEMS.filter((item) => LEARN.has(item.href));
  const tools = NAV_ITEMS.filter((item) => !LEARN.has(item.href));

  return (
    <Sidebar aria-label="Điều hướng chính" collapsible="icon">
      <SidebarHeader className="px-3 pt-4 pb-2">
        <Link href="/home" className="flex items-center gap-3 rounded-2xl outline-none focus-visible:ring-2 group-data-[collapsible=icon]:justify-center">
          <span
            aria-hidden="true"
            className="bg-primary text-primary-foreground grid size-10 shrink-0 place-items-center rounded-2xl shadow-[0_3px_0_var(--primary-edge)]"
          >
            <Languages className="size-5" />
          </span>
          <span className="text-primary truncate text-xl font-black tracking-tight group-data-[collapsible=icon]:hidden">
            OpenEngQuiz
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        <NavGroup label="Học" items={learn} pathname={pathname} />
        <NavGroup label="Công cụ" items={tools} pathname={pathname} />
      </SidebarContent>

      <SidebarFooter className="p-3">
        <div className="flex items-center gap-3 rounded-2xl border-2 p-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:p-0">
          <span
            aria-hidden="true"
            className="bg-secondary text-secondary-foreground grid size-9 shrink-0 place-items-center rounded-full text-sm font-black"
          >
            {initials(displayName)}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-bold group-data-[collapsible=icon]:hidden" title={displayName}>
            {displayName}
          </span>
          <form action={signOut} className="group-data-[collapsible=icon]:hidden">
            <button
              type="submit"
              aria-label="Đăng xuất"
              title="Đăng xuất"
              className="text-muted-foreground hover:bg-muted hover:text-destructive grid size-9 place-items-center rounded-xl transition-colors"
            >
              <LogOut className="size-5" aria-hidden="true" />
            </button>
          </form>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
