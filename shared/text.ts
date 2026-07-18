// Prose helpers shared by the cohort build script and the frontend renderers.
//
// Profiles are hand-written Markdown pasted out of Notion and Docs exports, so
// the source carries artifacts of where it was written. These normalize it the
// same way on both sides of the pipeline: the build script cleans what it seeds
// into D1, and the renderers clean what is already there.

/**
 * Authors write hard breaks as literal `<br/>`. Nothing renders raw HTML — the
 * Markdown component builds VDOM — so the tag has to become a real break here
 * or it reaches the reader as text. This is the one place that decides what a
 * `<br/>` means; `Markdown` only knows how to draw the token it leaves behind.
 */
const BREAK_RUN = /(?:\s*<br\s*\/?>\s*){2,}/gi;
const BREAK_ONE = /[^\S\n]*<br\s*\/?>[^\S\n]*/gi;

/**
 * The single spelling `normalizeBreaks` reduces every `<br/>` variant to.
 * `Markdown`'s INLINE regex matches this exact literal — the two must agree,
 * and `tests/profile-text.test.ts` pins the output that keeps them agreeing.
 */
const BREAK_TOKEN = "<br>";

/** Any HTML-ish tag. The letter after `<` keeps "a < b" and "<3" intact. */
const TAG = /<\/?[a-z][^>]*>/gi;

/** The same, minus the break token we mean to keep. */
const TAG_EXCEPT_BREAK = /<(?!br>)\/?[a-z][^>]*>/gi;

export function normalizeBreaks(text: string): string {
  return (
    text
      // Two or more in a row is how authors write a paragraph split.
      .replace(BREAK_RUN, "\n\n")
      .replace(BREAK_ONE, BREAK_TOKEN)
      // A break that opens or closes a block is spacing the author added by
      // hand, not a line break — the block boundary already provides it.
      .split(/\n{2,}/)
      .map((block) =>
        block
          .replace(/^(?:<br>\s*)+/, "")
          .replace(/(?:\s*<br>)+$/, "")
          .trim(),
      )
      .filter(Boolean)
      .join("\n\n")
  );
}

/** For the places that render authored text raw, with no Markdown pass. */
export function stripTags(text: string): string {
  return text.replace(TAG, " ").replace(/\s+/g, " ").trim();
}

/**
 * Everything authored prose needs before it is parsed as Markdown: the breaks
 * members typed become the one token the renderer draws, and every other tag
 * they typed is removed rather than shown.
 *
 * Removing the rest is the point. Members reached for HTML whenever Markdown
 * lacked a feature — 24 `<u>` for underline, which Markdown has no syntax for
 * — and each one reached the reader as literal text. Dropping the tag but
 * keeping its contents means the next tag someone invents fails quietly
 * instead of appearing on their profile.
 */
export function normalizeProse(text: string): string {
  return normalizeBreaks(text).replace(TAG_EXCEPT_BREAK, "");
}

/**
 * Openers, not taglines. Half the cohort starts with one, and taking the first
 * sentence verbatim turned 53 of 207 roster cards into "Hi!" or "Namasteee!".
 */
const GREETING =
  /^(hi+|hey+|hello+|halo|hai|greetings|namaste+|salam|assalamualaikum|good (morning|afternoon|evening))\b/i;

/** Long enough to have said something. Below this, keep reading. */
const MIN_LENGTH = 40;

function isGreeting(sentence: string): boolean {
  return sentence.length < 30 && GREETING.test(sentence);
}

/** A short, card-sized line: the first thing the author actually says. */
export function toTagline(text: string, max = 120): string {
  const flat = stripTags(text)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_~`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!flat) return "";

  const sentences = flat.split(/(?<=[.!?])\s+/);

  // Skip the greeting, but never skip the only thing they wrote.
  let i = 0;
  while (i < sentences.length - 1 && isGreeting(sentences[i])) i++;

  // One short sentence ("Hi!", "Design Student") rarely carries a card, so keep
  // taking sentences until the line says enough to be worth reading.
  let pick = "";
  for (; i < sentences.length && pick.length < MIN_LENGTH; i++) {
    pick = pick ? `${pick} ${sentences[i]}` : sentences[i];
  }

  if (pick.length <= max) return pick.trim();
  return pick.slice(0, max).replace(/\s+\S*$/, "").trim() + "…";
}

/** Loose identity for comparing a line against a person's name. */
export function loose(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}
