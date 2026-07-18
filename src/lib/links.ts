import type { ProfileLink, ProfileSection } from "../../shared/types";
import type { IconName } from "../components/Icon";

/**
 * A profile's links come from two places: the `links` the build script pulled
 * out of a "Contact" section, and the ones members simply typed into their
 * prose. Both the wall hero and the profile body show them, so the gathering
 * and the icon each host earns live here rather than in either component.
 */
export interface ResolvedLink extends ProfileLink {
  icon: IconName;
}

const SOCIAL =
  /https?:\/\/(?:www\.)?(linkedin\.com|github\.com|twitter\.com|x\.com|instagram\.com)\/[^\s)\]"']+/gi;

const HOSTS: { match: string[]; label: string; icon: IconName }[] = [
  { match: ["github.com"], label: "GitHub", icon: "github" },
  { match: ["linkedin.com"], label: "LinkedIn", icon: "linkedin" },
  { match: ["twitter.com", "x.com"], label: "Twitter", icon: "twitter" },
  { match: ["instagram.com"], label: "Instagram", icon: "instagram" },
];

function hostFor(url: string) {
  const lower = url.toLowerCase();
  return HOSTS.find((h) => h.match.some((m) => lower.includes(m)));
}

export function resolveProfileLinks({
  intro,
  sections,
  links,
}: {
  intro: string;
  sections: ProfileSection[];
  links: ProfileLink[];
}): ResolvedLink[] {
  const seen = new Set(links.map((l) => l.url));
  const found: ProfileLink[] = [];

  for (const text of [intro, ...sections.map((s) => s.body)]) {
    for (const raw of text.match(SOCIAL) ?? []) {
      // A URL ending a sentence keeps the full stop; the link doesn't.
      const url = raw.endsWith(".") ? raw.slice(0, -1) : raw;
      if (seen.has(url)) continue;
      seen.add(url);
      found.push({ label: hostFor(url)?.label ?? "Link", url });
    }
  }

  return [...links, ...found].map((l) => ({
    ...l,
    icon: hostFor(l.url)?.icon ?? "globe",
  }));
}
