/**
 * TipTap emits a ProseMirror JSON document; every social API takes plain text. The two are stored
 * side by side (`Post.contentJson` / `Post.content`), and this is the single place the conversion
 * happens — server-side, on save — so the editor and the publish pipeline can never disagree
 * about what the caption actually says.
 */

interface ProseMirrorNode {
  type?: string;
  text?: string;
  content?: ProseMirrorNode[];
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

/**
 * Node types that end a line rather than continuing the current one.
 *
 * `listItem` is deliberately absent: TipTap nests a paragraph inside every list item, and that
 * paragraph already ends the line. Including both flushed twice and rendered every list with a
 * blank line between items.
 */
const BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "bulletList",
  "orderedList",
  "codeBlock",
]);

export function proseMirrorToPlainText(doc: unknown): string {
  if (!doc || typeof doc !== "object") return "";

  const lines: string[] = [];
  let current = "";

  const flush = () => {
    lines.push(current);
    current = "";
  };

  const walk = (node: ProseMirrorNode) => {
    if (node.type === "text") {
      // A link's href is what the platform actually needs to see. TipTap keeps it in a mark, so
      // append it when it differs from the visible text — otherwise "click here" publishes with
      // no URL at all.
      const link = node.marks?.find((m) => m.type === "link");
      const href = typeof link?.attrs?.href === "string" ? link.attrs.href : null;
      const text = node.text ?? "";
      current += href && href !== text ? `${text} (${href})` : text;
      return;
    }

    if (node.type === "hardBreak") {
      flush();
      return;
    }

    if (node.type === "emoji" && typeof node.attrs?.["emoji"] === "string") {
      current += node.attrs["emoji"];
      return;
    }

    if (node.content) {
      for (const child of node.content) walk(child);
    }

    if (node.type && BLOCK_TYPES.has(node.type)) flush();
  };

  walk(doc as ProseMirrorNode);
  if (current) flush();

  return (
    lines
      .join("\n")
      // Collapse runs of 3+ blank lines that nested block nodes produce, but keep deliberate
      // paragraph breaks — they're meaningful in a caption.
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/** Wraps plain text back into a minimal TipTap document, for content that predates the editor. */
export function plainTextToProseMirror(text: string): ProseMirrorNode {
  return {
    type: "doc",
    content: text.split("\n").map((line) => ({
      type: "paragraph",
      ...(line ? { content: [{ type: "text", text: line }] } : {}),
    })),
  };
}

/**
 * Resolves what actually gets published for a post/target pair. Kept next to the serializer
 * because "which text wins" is the same question as "what is the text".
 */
export function resolveContent(
  post: { content: string; contentJson: unknown; firstComment: string | null },
  target: { contentOverride: string | null; contentJsonOverride: unknown; firstCommentOverride: string | null },
): { content: string; firstComment: string | null } {
  // An override of "" is a deliberate choice to publish nothing on that platform, so only
  // null/undefined falls back to the post.
  const content =
    target.contentOverride ??
    (target.contentJsonOverride ? proseMirrorToPlainText(target.contentJsonOverride) : post.content);

  return {
    content,
    firstComment: target.firstCommentOverride ?? post.firstComment,
  };
}
