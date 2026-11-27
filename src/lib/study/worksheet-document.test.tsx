import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { WorksheetDocument } from "./worksheet-document";

describe("worksheet PDF", () => {
  it("renders Vietnamese content with bundled fonts", async () => {
    const buffer = await renderToBuffer(
      <WorksheetDocument title="Từ vựng mỗi ngày" cards={[{
        id: "a",
        term: "apple",
        definition_vi: "quả táo",
        definition_en: null,
        example_en: null,
      }]} />,
    );
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
    expect(buffer.length).toBeGreaterThan(1000);
    const extracted = spawnSync("pdftotext", ["-", "-"], {
      input: buffer,
      encoding: "utf8",
    });
    if (!extracted.error) {
      expect(extracted.status).toBe(0);
      expect(extracted.stdout).toContain("quả táo");
    }
  });
});
