"use client";

import React, { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Italic,
  Strikethrough,
  Code as CodeIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  Undo2,
  Redo2,
  FileText,
  Edit3,
  Eye,
  Copy,
  Check,
} from "lucide-react";

interface TiptapEditorProps {
  content: string;
  editable?: boolean;
  className?: string;
  title?: string;
  onChange?: (html: string) => void;
}

export function TiptapEditor({
  content,
  editable: initialEditable = false,
  className = "",
  title = "Document",
  onChange,
}: TiptapEditorProps) {
  const [isEditable, setIsEditable] = useState(initialEditable);
  const [copied, setCopied] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
    ],
    content: content || "<p>Empty document</p>",
    editable: isEditable,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-invert prose-zinc max-w-none focus:outline-none min-h-[140px] px-4 py-3 text-sm text-zinc-200 leading-relaxed",
      },
    },
  });

  const toggleEditable = () => {
    if (!editor) return;
    const nextState = !isEditable;
    editor.setEditable(nextState);
    setIsEditable(nextState);
  };

  const handleCopy = () => {
    if (!editor) return;
    const text = editor.getText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!editor) {
    return (
      <div className="my-4 rounded-xl border border-zinc-800 bg-zinc-950 p-6 text-center text-xs text-zinc-500">
        Loading editor...
      </div>
    );
  }

  return (
    <div
      className={`my-4 rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-lg ${className}`}
    >
      {/* Header & Toolbar */}
      <div className="border-b border-zinc-800/80 bg-zinc-900/60 px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Document Title & Badge */}
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-purple-400" />
            <span className="text-xs font-semibold text-zinc-200">{title}</span>
            <span className="rounded bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-mono text-purple-400 border border-purple-500/20">
              Tiptap
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={toggleEditable}
              className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
                isEditable
                  ? "bg-purple-600/30 text-purple-300 border border-purple-500/40"
                  : "bg-zinc-800 text-zinc-300 hover:text-white"
              }`}
            >
              {isEditable ? (
                <>
                  <Eye className="h-3 w-3" />
                  Preview
                </>
              ) : (
                <>
                  <Edit3 className="h-3 w-3" />
                  Edit
                </>
              )}
            </button>
            <button
              onClick={handleCopy}
              className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
              title="Copy plain text"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Formatting Toolbar (shown when editable or as controls) */}
        {isEditable && (
          <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-zinc-800/60 pt-2 text-zinc-400">
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`rounded p-1.5 hover:bg-zinc-800 transition-colors ${
                editor.isActive("bold") ? "bg-zinc-800 text-white" : ""
              }`}
              title="Bold"
            >
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`rounded p-1.5 hover:bg-zinc-800 transition-colors ${
                editor.isActive("italic") ? "bg-zinc-800 text-white" : ""
              }`}
              title="Italic"
            >
              <Italic className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleStrike().run()}
              className={`rounded p-1.5 hover:bg-zinc-800 transition-colors ${
                editor.isActive("strike") ? "bg-zinc-800 text-white" : ""
              }`}
              title="Strikethrough"
            >
              <Strikethrough className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleCode().run()}
              className={`rounded p-1.5 hover:bg-zinc-800 transition-colors ${
                editor.isActive("code") ? "bg-zinc-800 text-white" : ""
              }`}
              title="Inline Code"
            >
              <CodeIcon className="h-3.5 w-3.5" />
            </button>

            <span className="h-4 w-px bg-zinc-800 mx-1" />

            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={`rounded p-1.5 hover:bg-zinc-800 transition-colors ${
                editor.isActive("heading", { level: 1 }) ? "bg-zinc-800 text-white" : ""
              }`}
              title="Heading 1"
            >
              <Heading1 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={`rounded p-1.5 hover:bg-zinc-800 transition-colors ${
                editor.isActive("heading", { level: 2 }) ? "bg-zinc-800 text-white" : ""
              }`}
              title="Heading 2"
            >
              <Heading2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              className={`rounded p-1.5 hover:bg-zinc-800 transition-colors ${
                editor.isActive("heading", { level: 3 }) ? "bg-zinc-800 text-white" : ""
              }`}
              title="Heading 3"
            >
              <Heading3 className="h-3.5 w-3.5" />
            </button>

            <span className="h-4 w-px bg-zinc-800 mx-1" />

            <button
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`rounded p-1.5 hover:bg-zinc-800 transition-colors ${
                editor.isActive("bulletList") ? "bg-zinc-800 text-white" : ""
              }`}
              title="Bullet List"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={`rounded p-1.5 hover:bg-zinc-800 transition-colors ${
                editor.isActive("orderedList") ? "bg-zinc-800 text-white" : ""
              }`}
              title="Ordered List"
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              className={`rounded p-1.5 hover:bg-zinc-800 transition-colors ${
                editor.isActive("blockquote") ? "bg-zinc-800 text-white" : ""
              }`}
              title="Blockquote"
            >
              <Quote className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              className="rounded p-1.5 hover:bg-zinc-800 transition-colors"
              title="Horizontal Rule"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>

            <span className="h-4 w-px bg-zinc-800 mx-1" />

            <button
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              className="rounded p-1.5 hover:bg-zinc-800 transition-colors disabled:opacity-30"
              title="Undo"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              className="rounded p-1.5 hover:bg-zinc-800 transition-colors disabled:opacity-30"
              title="Redo"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Editor Body */}
      <div className="min-h-[140px] bg-zinc-950/60 p-2">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
