"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Sáng", icon: Sun },
  { value: "dark", label: "Tối", icon: Moon },
  { value: "system", label: "Theo hệ thống", icon: Monitor },
] as const;

/**
 * Theme picker. The trigger icon switches through the `dark:` variant, so the server render
 * matches whatever theme the browser applies; the chosen option is only read once the menu opens.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Đổi giao diện sáng tối"
        title="Giao diện"
        className={cn("text-muted-foreground hover:bg-muted hover:text-foreground grid size-9 place-items-center rounded-xl transition-colors", className)}
      >
        <Sun aria-hidden="true" className="size-5 dark:hidden" />
        <Moon aria-hidden="true" className="hidden size-5 dark:block" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 rounded-2xl p-1.5">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => { setTheme(value); setOpen(false); }}
            aria-pressed={theme === value}
            className="hover:bg-muted flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-bold"
          >
            <Icon aria-hidden="true" className="size-4" />
            <span className="flex-1">{label}</span>
            {theme === value ? <Check aria-hidden="true" className="text-primary size-4" /> : null}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
