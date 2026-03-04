"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";

interface InlineEditTextProps {
  value: string;
  onSave: (value: string) => Promise<void> | void;
  placeholder?: string;
  multiline?: boolean;
  /** Extra classes on the display span */
  displayClassName?: string;
  /** Extra classes on the input/textarea */
  inputClassName?: string;
  disabled?: boolean;
}

/**
 * Click-to-edit inline text field. Shows text with a subtle pencil icon on hover.
 * On click, switches to an input/textarea with save (✓) and cancel (✗) buttons.
 */
export default function InlineEditText({
  value,
  onSave,
  placeholder = "Click to edit…",
  multiline = false,
  displayClassName = "",
  inputClassName = "",
  disabled = false,
}: InlineEditTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing, value]);

  const handleSave = async () => {
    if (draft.trim() === value.trim()) { setEditing(false); return; }
    setSaving(true);
    try {
      await onSave(draft.trim());
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  const handleCancel = () => {
    setDraft(value);
    setEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!multiline && e.key === "Enter") { e.preventDefault(); handleSave(); }
    if (e.key === "Escape") handleCancel();
  };

  if (disabled) {
    return <span className={displayClassName}>{value || <span className="text-white/25 italic">{placeholder}</span>}</span>;
  }

  if (editing) {
    const sharedInputCls = `bg-white/8 border border-blue-500/40 rounded-lg px-2 py-1 text-white/90 focus:outline-none focus:border-blue-400 resize-none ${inputClassName}`;
    return (
      <span className="inline-flex items-start gap-1.5 w-full" onClick={(e) => e.stopPropagation()}>
        {multiline ? (
          <textarea
            ref={inputRef as React.Ref<HTMLTextAreaElement>}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            className={`w-full ${sharedInputCls} text-xs`}
          />
        ) : (
          <input
            ref={inputRef as React.Ref<HTMLInputElement>}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`w-full ${sharedInputCls}`}
          />
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          title="Save"
          className="shrink-0 mt-0.5 w-6 h-6 rounded bg-green-500/20 hover:bg-green-500/35 text-green-400 flex items-center justify-center transition-colors"
        >
          {saving ? (
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
          ) : (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
        <button
          onClick={handleCancel}
          title="Cancel"
          className="shrink-0 mt-0.5 w-6 h-6 rounded bg-white/8 hover:bg-white/15 text-white/50 flex items-center justify-center transition-colors"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      title="Click to edit"
      className={`group inline-flex items-center gap-1.5 text-left hover:opacity-80 transition-opacity ${displayClassName}`}
    >
      {value ? (
        <span>{value}</span>
      ) : (
        <span className="text-white/25 italic">{placeholder}</span>
      )}
      <svg
        className="w-3 h-3 text-white/25 group-hover:text-blue-400/70 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
        />
      </svg>
    </button>
  );
}
