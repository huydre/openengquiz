import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next-path";

describe("safeNextPath", () => {
  it("keeps same-origin relative paths", () => {
    expect(safeNextPath("/sets/123?tab=learn")).toBe("/sets/123?tab=learn");
  });

  it.each([null, undefined, "", "home", "https://evil.com", "//evil.com", "/\\evil.com"])(
    "falls back to /home for unsafe value %s",
    (value) => {
      expect(safeNextPath(value)).toBe("/home");
    },
  );
});
