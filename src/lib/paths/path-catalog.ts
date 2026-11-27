import { parse } from "yaml";
import { z } from "zod";
import { levels, pathFields } from "./path-data";

const catalog = z.array(pathFields.extend({
  slug: z.string().max(120).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  words: z.number().int().min(1).max(60),
  sets: z.array(z.union([
    z.string().trim().min(1).max(200),
    z.object({ topic: z.string().trim().min(1).max(200), level: z.enum(levels) }),
  ])).min(1).max(20),
})).min(1).refine((paths) => new Set(paths.map((path) => path.slug)).size === paths.length, "Duplicate path slug");

export function parsePathCatalog(yaml: string) {
  return catalog.parse(parse(yaml)).map((path) => ({ ...path,
    sets: path.sets.map((set) => typeof set === "string" ? { topic: set, level: path.level } : set),
  }));
}
