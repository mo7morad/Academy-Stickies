// Shared validation for the member-editable profile, imported by both the API
// (which runs it as the authority) and the editor (which reads the limits for
// maxLength attributes and character counters).
//
// The reuse of shared/text.ts is deliberate: authored prose must behave the
// same whether it arrived through the Cohort/ import or through this editor.

import { normalizeProse, stripTags } from "./text";
import type { ProfileLink, ProfileSection } from "./types";

export const PROFILE_LIMITS = {
  name: 80,
  tagline: 160,
  intro: 4000,
  sectionTitle: 80,
  sectionBody: 4000,
  sections: 20,
  linkLabel: 40,
  linkUrl: 500,
  links: 10,
} as const;

export interface ProfileInput {
  name: string;
  tagline: string;
  intro: string;
  sections: ProfileSection[];
  links: ProfileLink[];
}

type Result =
  | { ok: true; value: ProfileInput }
  | { ok: false; error: string };

/** Titles, taglines and labels render raw (see stripTags in ProfileBody), so
 *  they are flattened to plain text; prose is normalized like the import. */
function cleanLine(raw: unknown, max: number): string {
  return stripTags(typeof raw === "string" ? raw : "").slice(0, max);
}

function cleanProse(raw: unknown, max: number): string {
  return normalizeProse(typeof raw === "string" ? raw : "").slice(0, max);
}

/** The one hard security edge: a URL rendered straight into an href. Only
 *  http(s) survives, so `javascript:` and friends never reach an anchor. */
function cleanUrl(raw: unknown): string | null {
  const trimmed = (typeof raw === "string" ? raw : "").trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return url.toString().slice(0, PROFILE_LIMITS.linkUrl);
}

export function sanitizeProfileInput(raw: unknown): Result {
  const body = (raw ?? {}) as Record<string, unknown>;

  const name = cleanLine(body.name, PROFILE_LIMITS.name);
  if (!name) return { ok: false, error: "Your name can't be empty." };

  const tagline = cleanLine(body.tagline, PROFILE_LIMITS.tagline);
  const intro = cleanProse(body.intro, PROFILE_LIMITS.intro);

  const rawSections = Array.isArray(body.sections) ? body.sections : [];
  const sections: ProfileSection[] = [];
  for (const s of rawSections.slice(0, PROFILE_LIMITS.sections)) {
    const item = (s ?? {}) as Record<string, unknown>;
    const title = cleanLine(item.title, PROFILE_LIMITS.sectionTitle);
    const bodyText = cleanProse(item.body, PROFILE_LIMITS.sectionBody);
    // An empty "Add section" the author never filled in is dropped, not an error.
    if (!title && !bodyText) continue;
    sections.push({ title, body: bodyText });
  }

  const rawLinks = Array.isArray(body.links) ? body.links : [];
  const links: ProfileLink[] = [];
  for (const l of rawLinks.slice(0, PROFILE_LIMITS.links)) {
    const item = (l ?? {}) as Record<string, unknown>;
    const url = cleanUrl(item.url);
    if (!url) continue; // a blank or non-http URL drops the whole row
    let label = cleanLine(item.label, PROFILE_LIMITS.linkLabel);
    if (!label) {
      try {
        label = new URL(url).hostname.replace(/^www\./, "");
      } catch {
        label = "Link";
      }
    }
    links.push({ label, url });
  }

  return { ok: true, value: { name, tagline, intro, sections, links } };
}
