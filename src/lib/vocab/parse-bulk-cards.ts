export type BulkCard = { term: string; definition_vi: string };
export type BulkParseResult = { cards: BulkCard[]; errors: { line: number; message: string }[] };

function splitCsvLine(line: string): string[] | null {
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (quoted || !field.trim()) {
        quoted = !quoted;
      } else {
        return null;
      }
    } else if (char === "," && !quoted) {
      fields.push(field.trim());
      field = "";
    } else {
      field += char;
    }
  }
  if (quoted) return null;
  fields.push(field.trim());
  return fields;
}

function firstUnquotedComma(line: string): number {
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '"') {
      if (quoted && line[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (line[index] === "," && !quoted) return index;
  }
  return -1;
}

function firstUnquotedDash(line: string): number {
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '"') {
      if (quoted && line[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted && line.slice(index, index + 3) === " - ") return index;
  }
  return -1;
}

/** Parses pasted lines, preserving line numbers for correction before import. */
export function parseBulkCards(input: string): BulkParseResult {
  const cards: BulkCard[] = [];
  const errors: BulkParseResult["errors"] = [];
  input.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;
    let fields: string[] | null;
    const dash = firstUnquotedDash(line);
    const comma = firstUnquotedComma(line);
    if (line.includes("\t")) fields = line.split("\t").map((part) => part.trim());
    else if (dash >= 0 && (comma < 0 || dash < comma)) {
      fields = [line.slice(0, dash).trim(), line.slice(dash + 3).trim()];
    } else fields = comma >= 0 ? splitCsvLine(line) : null;
    if (!fields || fields.length !== 2 || !fields[0] || !fields[1] || fields[0].length > 200) {
      errors.push({ line: index + 1, message: "Dùng định dạng từ - nghĩa, tab hoặc CSV hai cột." });
      return;
    }
    cards.push({ term: fields[0], definition_vi: fields[1] });
  });
  return { cards, errors };
}
