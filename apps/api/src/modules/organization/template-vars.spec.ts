import {
  applyTemplateVariables,
  extractTemplateVariables,
  slugifyTag,
} from "@social-platform/shared";

describe("slugifyTag", () => {
  it("lowercases and hyphenates", () => {
    expect(slugifyTag("Product Launch")).toBe("product-launch");
  });

  it("strips punctuation and collapses separators", () => {
    expect(slugifyTag("Q1 -- 2026!! Campaign")).toBe("q1-2026-campaign");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugifyTag("  spaced  ")).toBe("spaced");
  });
});

describe("extractTemplateVariables", () => {
  it("finds each placeholder once, in order of first appearance", () => {
    expect(extractTemplateVariables("Hi {{name}}, meet {{name}} and {{other}}")).toEqual([
      "name",
      "other",
    ]);
  });

  it("tolerates internal whitespace", () => {
    expect(extractTemplateVariables("{{ spaced }}")).toEqual(["spaced"]);
  });

  it("returns nothing when there are no placeholders", () => {
    expect(extractTemplateVariables("plain text")).toEqual([]);
  });
});

describe("applyTemplateVariables", () => {
  it("substitutes supplied values", () => {
    expect(applyTemplateVariables("Hi {{name}}", { name: "Ada" })).toBe("Hi Ada");
  });

  it("leaves an unsupplied placeholder visible rather than blanking it", () => {
    // A half-filled template should be obvious in the composer, not publish with a hole in it.
    expect(applyTemplateVariables("Hi {{name}}", {})).toBe("Hi {{name}}");
  });

  it("substitutes an explicitly empty value", () => {
    expect(applyTemplateVariables("Hi {{name}}!", { name: "" })).toBe("Hi !");
  });

  it("replaces every occurrence", () => {
    expect(applyTemplateVariables("{{x}}-{{x}}", { x: "1" })).toBe("1-1");
  });
});
