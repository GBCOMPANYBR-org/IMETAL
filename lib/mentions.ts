// Inline mention syntax used inside Observação text: "@[Nome](123)". Deliberately not a
// contenteditable/rich-text token — a plain substring the textarea can insert and the server can
// re-parse. The server is the only place ids are ever trusted from: it always re-derives the
// mentioned user ids from the submitted text itself (see parseMentionIds), never from a separate
// client-supplied array, so a manipulated request can't attach a mention the text doesn't contain.
const MENTION_TOKEN_RE = /@\[([^\]]+)\]\((\d+)\)/g;

/** Extracts every mentioned user id from raw Observação text, deduplicated, in first-seen order. */
export function parseMentionIds(text: string): number[] {
  const seen = new Set<number>();
  const ids: number[] = [];
  for (const match of text.matchAll(MENTION_TOKEN_RE)) {
    const id = Number(match[2]);
    if (Number.isInteger(id) && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

/** Builds the inline token to insert into the textarea when a user is picked from the @ dropdown. */
export function formatMentionToken(name: string, userId: number): string {
  // Mention names come from our own User records, not free text, so "]"/")" collisions are not a
  // real-world concern — still strip "]" defensively so a stray one can never prematurely close
  // the token and desync the id that follows it.
  const safeName = name.replace(/\]/g, "");
  return `@[${safeName}](${userId})`;
}

/**
 * Strips mention tokens down to a plain "@Nome" for contexts with no access to the live User
 * records (e.g. a quick preview). Prefer resolving the display name from `mentions[].mentionedUser`
 * on the fetched Observacao whenever that's available — never trust the bracketed name for
 * anything the user reads as fact, since it's just whatever text was inserted at type time and a
 * hand-crafted request could put any string there for a still-valid id.
 */
export function stripMentionSyntax(text: string): string {
  return text.replace(MENTION_TOKEN_RE, (_match, name) => `@${name}`);
}
