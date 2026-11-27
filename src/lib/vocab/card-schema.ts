import { z } from "zod";

export const cardSchema = z.object({
  term: z.string().trim().min(1, "Nhập từ tiếng Anh.").max(200),
  definition_vi: z.string().trim().max(2000).nullable().optional(),
  definition_en: z.string().trim().max(2000).nullable().optional(),
  part_of_speech: z.string().trim().max(100).nullable().optional(),
  ipa: z.string().trim().max(100).nullable().optional(),
  example_en: z.string().trim().max(2000).nullable().optional(),
  example_vi: z.string().trim().max(2000).nullable().optional(),
  synonyms: z.array(z.string().trim().min(1).max(200)).max(30).default([]),
});

export type CardInput = z.input<typeof cardSchema>;
