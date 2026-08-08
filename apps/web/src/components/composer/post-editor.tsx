"use client";

import { useEffect } from "react";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { Bold, Italic, Link2, List, ListOrdered, Strikethrough } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The rich-text surface. Emits both the ProseMirror document and its plain-text rendering; the
 * server re-derives the plain text on save (content-serializer.ts) and treats that as canonical,
 * so this is purely for a responsive character counter.
 */
export function PostEditor({
  content,
  onChange,
  placeholder = "What do you want to share?",
  editable = true,
  compact = false,
}: {
  content: JSONContent | null;
  onChange: (doc: JSONContent, text: string) => void;
  placeholder?: string;
  editable?: boolean;
  compact?: boolean;
}) {
  const editor = useEditor({
    // Next renders this on the server first; without the flag React logs a hydration mismatch.
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({
        heading: false, // captions have no headings on any platform
        codeBlock: false,
        horizontalRule: false,
      }),
      Placeholder.configure({ placeholder }),
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: content ?? undefined,
    editorProps: {
      attributes: {
        class: cn(
          "prose-sm max-w-none focus:outline-none",
          compact ? "min-h-[100px]" : "min-h-[180px]",
        ),
      },
    },
    onUpdate: ({ editor: instance }) => {
      onChange(instance.getJSON(), instance.getText());
    },
  });

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  if (!editor) {
    return <div className={cn("rounded-md border border-input", compact ? "h-[130px]" : "h-[210px]")} />;
  }

  const toolbar = [
    { icon: Bold, label: "Bold", action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive("bold") },
    { icon: Italic, label: "Italic", action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive("italic") },
    { icon: Strikethrough, label: "Strikethrough", action: () => editor.chain().focus().toggleStrike().run(), active: editor.isActive("strike") },
    { icon: List, label: "Bullet list", action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive("bulletList") },
    { icon: ListOrdered, label: "Numbered list", action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive("orderedList") },
  ];

  return (
    <div className="rounded-md border border-input focus-within:ring-2 focus-within:ring-ring">
      {editable && (
        <div className="flex items-center gap-0.5 border-b border-border px-1.5 py-1">
          {toolbar.map(({ icon: Icon, label, action, active }) => (
            <button
              key={label}
              type="button"
              onClick={action}
              aria-label={label}
              aria-pressed={active}
              className={cn(
                "rounded p-1.5 transition-colors hover:bg-accent",
                active && "bg-accent text-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
          <button
            type="button"
            aria-label="Add link"
            onClick={() => {
              const previous = editor.getAttributes("link").href as string | undefined;
              const url = window.prompt("Link URL", previous ?? "https://");
              if (url === null) return;
              if (url === "") {
                editor.chain().focus().extendMarkRange("link").unsetLink().run();
                return;
              }
              editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
            }}
            className={cn(
              "rounded p-1.5 transition-colors hover:bg-accent",
              editor.isActive("link") && "bg-accent text-accent-foreground",
            )}
          >
            <Link2 className="h-4 w-4" />
          </button>
        </div>
      )}
      <EditorContent editor={editor} className="px-3 py-2 text-sm [&_p]:my-1 [&_a]:text-primary [&_a]:underline [&_ul]:list-disc [&_ol]:list-decimal [&_ul,&_ol]:pl-5 [&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:text-muted-foreground [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]" />
    </div>
  );
}
