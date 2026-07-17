// Shared types used by both the Pages Functions API and the Preact frontend.

export const STICKY_COLORS = [
  "yellow",
  "blue",
  "green",
  "pink",
  "purple",
  "gray",
] as const;

export type StickyColor = (typeof STICKY_COLORS)[number];

export interface Me {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  wallPublic: boolean;
}

/** One "## About Me"-style block from a cohort profile. Body is Markdown. */
export interface ProfileSection {
  title: string;
  body: string;
}

export interface ProfileLink {
  label: string;
  url: string;
}

/** A learner's academy profile. Visible to any signed-in member: it introduces
 *  them to the cohort, and is deliberately independent of wall visibility. */
export interface Profile {
  session: string | null; // "AM" | "PM"
  tagline: string | null;
  intro: string;
  sections: ProfileSection[];
  links: ProfileLink[];
}

/** A senior/mentor. Not a roster member: no wall, no stickies, no sign-in. */
export interface Mentor {
  id: string;
  slug: string;
  name: string;
  nickname: string | null;
  role: string | null;
  skills: string[];
  tagline: string | null;
  photoUrl: string | null;
  intro: string;
  sections: ProfileSection[];
  links: ProfileLink[];
}

export interface RosterMember {
  id: string;
  name: string;
  avatarUrl: string | null;
  wallPublic: boolean;
  isSelf: boolean;
  receivedCount: number;
  session: string | null;
  tagline: string | null;
}

export interface Sticky {
  id: string;
  authorName: string | null; // codename (e.g. "Pink Leopard") when anonymous
  authorColor: string | null; // accent hex for the codename, else null
  isAnonymous: boolean;
  mine: boolean; // did the current viewer author it (non-anonymous only)
  describedAs: string;
  goodAt: string;
  color: StickyColor;
  photoUrl: string | null;
  createdAt: number;
}

export interface WallResponse {
  member: RosterMember;
  isSelf: boolean;
  visible: boolean; // false => private wall the viewer may not see
  stickies: Sticky[];
  profile: Profile | null; // shown even when the wall itself is private
}

export interface CreateStickyResult {
  sticky: Sticky;
}

export const MAX_FIELD_LEN = 280;
