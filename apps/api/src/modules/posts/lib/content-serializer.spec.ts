import {
  plainTextToProseMirror,
  proseMirrorToPlainText,
  resolveContent,
} from "./content-serializer";

describe("proseMirrorToPlainText", () => {
  it("joins paragraphs with newlines", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "One" }] },
        { type: "paragraph", content: [{ type: "text", text: "Two" }] },
      ],
    };
    expect(proseMirrorToPlainText(doc)).toBe("One\nTwo");
  });

  it("appends a link's href when it differs from the visible text", () => {
    // Without this, "click here" would publish with no URL at all.
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "click here",
              marks: [{ type: "link", attrs: { href: "https://example.com" } }],
            },
          ],
        },
      ],
    };
    expect(proseMirrorToPlainText(doc)).toBe("click here (https://example.com)");
  });

  it("does not duplicate a URL that is already its own link text", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "https://example.com",
              marks: [{ type: "link", attrs: { href: "https://example.com" } }],
            },
          ],
        },
      ],
    };
    expect(proseMirrorToPlainText(doc)).toBe("https://example.com");
  });

  it("collapses runs of blank lines from nested blocks but keeps paragraph breaks", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "A" }] },
        { type: "paragraph" },
        { type: "paragraph" },
        { type: "paragraph", content: [{ type: "text", text: "B" }] },
      ],
    };
    expect(proseMirrorToPlainText(doc)).toBe("A\n\nB");
  });

  it("renders list items on their own lines", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "y" }] }] },
          ],
        },
      ],
    };
    expect(proseMirrorToPlainText(doc)).toBe("x\ny");
  });

  it("returns an empty string for null or non-object input", () => {
    expect(proseMirrorToPlainText(null)).toBe("");
    expect(proseMirrorToPlainText(undefined)).toBe("");
    expect(proseMirrorToPlainText("nope")).toBe("");
  });

  it("round-trips plain text", () => {
    const text = "Line one\nLine two";
    expect(proseMirrorToPlainText(plainTextToProseMirror(text))).toBe(text);
  });
});

describe("resolveContent", () => {
  const post = { content: "shared", contentJson: null, firstComment: "shared fc" };
  const noOverride = {
    contentOverride: null,
    contentJsonOverride: null,
    firstCommentOverride: null,
  };

  it("falls back to the post when the target overrides nothing", () => {
    expect(resolveContent(post, noOverride)).toEqual({
      content: "shared",
      firstComment: "shared fc",
    });
  });

  it("prefers the target's override", () => {
    expect(resolveContent(post, { ...noOverride, contentOverride: "tailored" }).content).toBe(
      "tailored",
    );
  });

  it("treats an empty-string override as a deliberate choice, not a fallback", () => {
    // Publishing nothing on one platform is a legitimate decision; only null/undefined inherits.
    expect(resolveContent(post, { ...noOverride, contentOverride: "" }).content).toBe("");
  });

  it("serializes a target's rich-text override", () => {
    const doc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "from json" }] }],
    };
    expect(resolveContent(post, { ...noOverride, contentJsonOverride: doc }).content).toBe(
      "from json",
    );
  });

  it("overrides the first comment independently of the body", () => {
    expect(
      resolveContent(post, { ...noOverride, firstCommentOverride: "target fc" }).firstComment,
    ).toBe("target fc");
  });
});
