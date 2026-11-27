export type CardRecord = {
  id: string;
  position: number;
  term: string;
  definition_vi: string | null;
  definition_en: string | null;
  part_of_speech: string | null;
  ipa: string | null;
  example_en: string | null;
  example_vi: string | null;
  synonyms: string[];
  image_url?: string | null;
};
