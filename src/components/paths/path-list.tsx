import Link from "next/link";
import type { PathCard } from "@/lib/paths/path-data";

export function PathList({ paths }: { paths: PathCard[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {paths.map((path) => (
        <li key={path.id} className="rounded-3xl border-2 p-5 shadow-[0_4px_0_var(--border)]">
          <p className="text-primary text-xs font-bold">{[path.level, ...path.tags].join(" · ")}</p>
          <Link href={`/paths/${path.id}`} className="font-extrabold hover:underline">{path.title}</Link>
          {path.description && <p className="text-muted-foreground mt-1 text-sm">{path.description}</p>}
        </li>
      ))}
    </ul>
  );
}
