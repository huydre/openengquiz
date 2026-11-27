export type NavItem = {
  href: string;
  label: string;
  /** Set when the destination page is not built yet; rendered disabled. */
  comingSoon?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/home", label: "Trang chủ" },
  { href: "/sets", label: "Bộ từ" },
  { href: "/review", label: "Ôn tập" },
  { href: "/pronunciation", label: "Luyện phát âm" },
  { href: "/history", label: "Lịch sử học AI" },
  { href: "/stats", label: "Thống kê" },
  { href: "/courses", label: "Khoá học" },
  { href: "/classes", label: "Lớp học", comingSoon: true },
  { href: "/lookup", label: "Tra từ" },
];
