import type { ComponentChildren } from "preact";
import { normalizeProse } from "../../shared/text";

/**
 * A deliberately small Markdown renderer for cohort profile prose.
 *
 * Profiles are written by members, so this builds VDOM directly instead of
 * setting innerHTML — there is no path for authored text to become markup.
 * It covers what people actually wrote: paragraphs, bullet/numbered lists,
 * bold, italics and links. Anything else renders as plain text.
 *
 * The one exception is the hard break authors wrote as `<br/>`: escaping it
 * put the tag on screen. `normalizeProse` reduces every spelling of it to the
 * literal `<br>` that the last INLINE alternative below matches, and that
 * alternative emits an element — the author's tag never becomes markup, it
 * becomes a break we chose to draw. Every other tag it removes outright.
 */

const INLINE =
  /\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|(?<![\w*])\*([^*\n]+)\*(?![\w*])|(https?:\/\/[^\s<>()[\]]+)|(<br>)/g;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function Link({ href, children }: { href: string; children: ComponentChildren }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow">
      {children}
    </a>
  );
}

function inline(text: string): ComponentChildren[] {
  const out: ComponentChildren[] = [];
  let last = 0;
  let key = 0;

  INLINE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INLINE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));

    const [, label, url, bold, boldAlt, italic, bare, br] = m;
    if (br) {
      out.push(<br key={key++} />);
    } else if (url) {
      out.push(
        <Link key={key++} href={url}>
          {label?.trim() || hostOf(url)}
        </Link>,
      );
    } else if (bold || boldAlt) {
      out.push(<strong key={key++}>{bold ?? boldAlt}</strong>);
    } else if (italic) {
      out.push(<em key={key++}>{italic}</em>);
    } else if (bare) {
      // Trailing punctuation belongs to the sentence, not the URL.
      const clean = bare.replace(/[.,;:!?]+$/, "");
      out.push(
        <Link key={key++} href={clean}>
          {hostOf(clean)}
        </Link>,
      );
      if (clean !== bare) out.push(bare.slice(clean.length));
    }
    last = INLINE.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*\S)\s*$/;

export function Markdown({ text }: { text: string }) {
  const lines = normalizeProse(text).split("\n");
  const blocks: ComponentChildren[] = [];

  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    // Single newlines inside a block are soft wraps, as in Markdown.
    blocks.push(<p key={blocks.length}>{inline(paragraph.join(" "))}</p>);
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    const items = list.items.map((item, i) => <li key={i}>{inline(item)}</li>);
    blocks.push(
      list.ordered ? (
        <ol key={blocks.length}>{items}</ol>
      ) : (
        <ul key={blocks.length}>{items}</ul>
      ),
    );
    list = null;
  };

  const flushAll = () => {
    flushParagraph();
    flushList();
  };

  for (const line of lines) {
    if (!line.trim()) {
      flushAll();
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      flushAll();
      blocks.push(
        <p key={blocks.length}>
          <strong>{inline(heading[1])}</strong>
        </p>,
      );
      continue;
    }

    const bullet = line.match(BULLET);
    const numbered = !bullet ? line.match(NUMBERED) : null;
    if (bullet || numbered) {
      flushParagraph();
      const ordered = !!numbered;
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push((bullet?.[1] ?? numbered?.[1] ?? "").trim());
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }
  flushAll();

  return <div class="prose">{blocks}</div>;
}
