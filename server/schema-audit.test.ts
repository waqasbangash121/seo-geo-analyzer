import { describe, it, expect } from "vitest";
import { cleanBrandName } from "./schema-audit";

describe("cleanBrandName", () => {
  it("falls back to the domain when there is no title", () => {
    expect(cleanBrandName(undefined, "example.com")).toBe("example.com");
    expect(cleanBrandName("", "example.com")).toBe("example.com");
  });

  it("keeps only the leading segment before a separator", () => {
    expect(cleanBrandName("Acme Co — The best widgets", "acme.com")).toBe("Acme Co");
    expect(cleanBrandName("Acme Co | Home", "acme.com")).toBe("Acme Co");
    expect(cleanBrandName("Acme Co · Blog", "acme.com")).toBe("Acme Co");
  });

  it("strips concatenated navigation/boilerplate noise", () => {
    const messy =
      "Smashing Magazine — For Web Designers And DevelopersClear SearchBack to top";
    expect(cleanBrandName(messy, "smashingmagazine.com")).toBe("Smashing Magazine");
  });

  it("returns the fallback if cleaning leaves too little", () => {
    expect(cleanBrandName("| Home", "example.com")).toBe("example.com");
  });

  it("caps absurdly long names", () => {
    const long = "A".repeat(200);
    expect(cleanBrandName(long, "example.com").length).toBeLessThanOrEqual(80);
  });
});
