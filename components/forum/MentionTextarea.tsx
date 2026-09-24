"use client";

import { useEffect, useRef, useState } from "react";
import { formatMentionToken } from "@/lib/mentions";

interface MentionUser {
  id: number;
  name: string;
  username: string;
}

interface Props {
  pedidoId: number;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
}

/** Finds an in-progress "@query" ending at `cursor`, or null if the cursor isn't inside one. */
function detectMention(text: string, cursor: number): { query: string; start: number } | null {
  const before = text.slice(0, cursor);
  const match = /(?:^|\s)@([^\s@]*)$/.exec(before);
  if (!match) return null;
  const query = match[1];
  return { query, start: before.length - query.length - 1 };
}

/**
 * A plain <textarea> (not contenteditable/rich-text — no such lib is installed in this project)
 * that opens a searchable @ dropdown while typing. Inserts an inline "@[Nome](id)" token on pick
 * (see lib/mentions.ts) — the server re-parses and re-validates those ids on submit, so this
 * component's job is purely UX, not a security boundary.
 */
export default function MentionTextarea({ pedidoId, value, onChange, placeholder, rows = 3, autoFocus }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [queryStart, setQueryStart] = useState(0);
  const [results, setResults] = useState<MentionUser[]>([]);
  const [highlighted, setHighlighted] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query === null) {
      setResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetch(`/api/pedidos/${pedidoId}/mentionable-users?q=${encodeURIComponent(query)}`)
        .then((res) => (res.ok ? res.json() : []))
        .then((data: MentionUser[]) => {
          setResults(data);
          setHighlighted(0);
        })
        .catch(() => setResults([]));
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, pedidoId]);

  function syncMentionState(text: string, cursor: number) {
    const mention = detectMention(text, cursor);
    if (mention) {
      setQuery(mention.query);
      setQueryStart(mention.start);
    } else {
      setQuery(null);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value;
    onChange(text);
    syncMentionState(text, e.target.selectionStart ?? text.length);
  }

  function selectUser(user: MentionUser) {
    const textarea = textareaRef.current;
    const cursor = textarea?.selectionStart ?? value.length;
    const before = value.slice(0, queryStart);
    const after = value.slice(cursor);
    const token = `${formatMentionToken(user.name, user.id)} `;
    const next = before + token + after;
    onChange(next);
    setQuery(null);
    setResults([]);
    requestAnimationFrame(() => {
      if (!textarea) return;
      textarea.focus();
      const pos = before.length + token.length;
      textarea.setSelectionRange(pos, pos);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (query === null || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => (h + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => (h - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectUser(results[highlighted]);
    } else if (e.key === "Escape") {
      setQuery(null);
    }
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        autoFocus={autoFocus}
        rows={rows}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onClick={(e) => syncMentionState(value, e.currentTarget.selectionStart ?? 0)}
      />
      {query !== null && results.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-48 w-full max-w-xs overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {results.map((u, i) => (
            <button
              key={u.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                selectUser(u);
              }}
              className={`block w-full px-3 py-1.5 text-left text-sm ${i === highlighted ? "bg-brand text-white" : "text-slate-700 hover:bg-slate-100"}`}
            >
              <span className="font-medium">{u.name}</span>
              <span className={`ml-1 text-xs ${i === highlighted ? "text-white/80" : "text-slate-400"}`}>@{u.username}</span>
            </button>
          ))}
        </div>
      )}
      <p className="mt-1 text-xs text-slate-400">Digite @ para marcar alguém — só aparecem pessoas com acesso a esta empresa.</p>
    </div>
  );
}
