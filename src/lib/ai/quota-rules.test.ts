import { describe, expect, it } from "vitest";
import { startOfLocalDayUtc } from "./quota-rules";

describe("startOfLocalDayUtc (Asia/Ho_Chi_Minh, UTC+7)", () => {
  it("returns 17:00 UTC of the previous UTC day for a morning in Vietnam", () => {
    // 2026-11-26 08:00 in Vietnam = 01:00 UTC
    expect(startOfLocalDayUtc(new Date("2026-11-26T01:00:00Z")).toISOString()).toBe(
      "2026-11-25T17:00:00.000Z",
    );
  });

  it("rolls over exactly at local midnight", () => {
    // 23:59 local on the 26th vs 00:00 local on the 27th
    expect(startOfLocalDayUtc(new Date("2026-11-26T16:59:00Z")).toISOString()).toBe(
      "2026-11-25T17:00:00.000Z",
    );
    expect(startOfLocalDayUtc(new Date("2026-11-26T17:00:00Z")).toISOString()).toBe(
      "2026-11-26T17:00:00.000Z",
    );
  });
});
