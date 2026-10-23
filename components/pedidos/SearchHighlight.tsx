import type { ReactNode } from "react";

const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

/** Destaca somente as ocorrências dos termos buscados, inclusive com acentos. */
export default function SearchHighlight({ text, search }: { text: string | number | null | undefined; search: string }): ReactNode {
  const value = String(text ?? "");
  const terms = [...new Set(normalize(search).trim().split(/\s+/).filter(Boolean))];
  if (!terms.length || !value) return value;
  const normalized = normalize(value);
  const marked = new Array(value.length).fill(false);
  for (const term of terms) {
    let from = 0;
    while (from < normalized.length) {
      const at = normalized.indexOf(term, from);
      if (at < 0) break;
      for (let i = at; i < Math.min(at + term.length, marked.length); i++) marked[i] = true;
      from = at + Math.max(1, term.length);
    }
  }
  const parts: ReactNode[] = [];
  for (let start = 0; start < value.length;) {
    let end = start + 1;
    while (end < value.length && marked[end] === marked[start]) end++;
    const part = value.slice(start, end);
    parts.push(marked[start]
      ? <mark key={start} className="rounded-sm bg-[#3390ff] text-white">{part}</mark>
      : part);
    start = end;
  }
  return <>{parts}</>;
}
