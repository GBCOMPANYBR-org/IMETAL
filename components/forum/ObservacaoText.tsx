interface MentionRef {
  mentionedUser: { id: number; name: string; username: string };
}

interface Props {
  text: string;
  mentions: MentionRef[];
}

const MENTION_TOKEN_RE = /@\[([^\]]+)\]\((\d+)\)/g;

/**
 * Renders Observação text, replacing inline "@[Nome](id)" tokens with a highlighted "@Nome".
 * The displayed name always comes from the `mentions` lookup (the real ObservacaoMention.mentionedUser
 * record), never from the bracketed text in the token itself — that text is just whatever was
 * present at type time and isn't trustworthy for display (see lib/mentions.ts).
 */
export default function ObservacaoText({ text, mentions }: Props) {
  const nameById = new Map(mentions.map((m) => [m.mentionedUser.id, m.mentionedUser.name]));
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of text.matchAll(MENTION_TOKEN_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) parts.push(text.slice(lastIndex, index));
    const id = Number(match[2]);
    const name = nameById.get(id) ?? "usuário";
    parts.push(
      <span key={key++} className="rounded bg-brand-accent/20 px-1 font-medium text-brand-light">
        @{name}
      </span>
    );
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return <span className="whitespace-pre-wrap">{parts}</span>;
}
