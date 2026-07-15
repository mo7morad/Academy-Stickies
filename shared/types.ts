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

export interface RosterMember {
  id: string;
  name: string;
  avatarUrl: string | null;
  wallPublic: boolean;
  isSelf: boolean;
  receivedCount: number;
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
}

export interface CreateStickyResult {
  sticky: Sticky;
}

export const MAX_FIELD_LEN = 280;
