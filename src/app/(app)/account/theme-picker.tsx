"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Sáng", icon: Sun },
  { value: "dark", label: "Tối", icon: Moon },
  { value: "system", label: "Hệ thống", icon: Monitor },
] as const;

const subscribe = () => () => {};

/** Inline light/dark/system switch for the account settings. */
export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  // The stored theme is only known in the browser; render no selection on the server.
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  return (
    <div role="radiogroup" aria-label="Giao diện" className="bg-muted flex rounded-2xl p-1">
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const selected = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setTheme(value)}
            className={cn("flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-extrabold transition-colors", selected ? "bg-card text-primary-edge shadow-sm ring-2 ring-primary/40" : "text-muted-foreground hover:text-foreground")}
          >
            <Icon className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
