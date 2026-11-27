import { describe, expect, it } from "vitest";
import { routeRedirect } from "./route-access";

describe("routeRedirect", () => {
  it("sends signed-in users away from /login to home", () => {
    expect(routeRedirect("/login", "", true)).toBe("/home");
  });

  it("sends signed-in users on /login to a safe ?next target", () => {
    expect(routeRedirect("/login", "?next=%2Fsets%2Fabc", true)).toBe("/sets/abc");
    expect(routeRedirect("/login", "?next=https%3A%2F%2Fevil.com", true)).toBe("/home");
    expect(routeRedirect("/login", "?next=%2F%2Fevil.com", true)).toBe("/home");
    expect(routeRedirect("/login", "?next=%2Flogin", true)).toBe("/home");
  });

  it("protects app pages by default, including ones not listed anywhere", () => {
    expect(routeRedirect("/home", "", false)).toBe("/login?next=%2Fhome");
    expect(routeRedirect("/courses/ielts/lessons/123", "", false)).toBe("/login?next=%2Fcourses%2Fielts%2Flessons%2F123");
    expect(routeRedirect("/some-new-page", "", false)).toBe("/login?next=%2Fsome-new-page");
  });

  it("keeps the query string in ?next", () => {
    expect(routeRedirect("/review", "?set=abc", false)).toBe("/login?next=%2Freview%3Fset%3Dabc");
  });

  it("lets guests open public pages, auth callbacks, shared sets, APIs and files", () => {
    for (const path of ["/", "/login", "/privacy", "/terms", "/opengraph-image", "/auth/callback", "/shared/abc", "/api/tts", "/fonts/BeVietnamPro-Regular.ttf", "/robots.txt"]) {
      expect(routeRedirect(path, "", false)).toBeNull();
    }
  });

  it("lets signed-in users open everything except guest-only pages", () => {
    for (const path of ["/", "/home", "/shared/abc", "/sets/abc"]) {
      expect(routeRedirect(path, "", true)).toBeNull();
    }
  });
});
