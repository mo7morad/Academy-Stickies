// Stable, non-reversible codenames for anonymous stickies, e.g. "Pink Leopard".
// Derived from a seed that includes a server secret, so a recipient can't
// enumerate roster ids to unmask a sender — and author_id is never stored.

const COLORS: { name: string; hex: string }[] = [
  { name: "Coral", hex: "#FF6B6B" },
  { name: "Amber", hex: "#F59E0B" },
  { name: "Gold", hex: "#EAB308" },
  { name: "Lime", hex: "#84CC16" },
  { name: "Jade", hex: "#10B981" },
  { name: "Teal", hex: "#14B8A6" },
  { name: "Sky", hex: "#0EA5E9" },
  { name: "Cobalt", hex: "#4262FF" },
  { name: "Indigo", hex: "#6366F1" },
  { name: "Violet", hex: "#8B5CF6" },
  { name: "Orchid", hex: "#C026D3" },
  { name: "Pink", hex: "#EC4899" },
  { name: "Rose", hex: "#F43F5E" },
  { name: "Slate", hex: "#64748B" },
];

const ANIMALS = [
  "Leopard", "Otter", "Falcon", "Panda", "Fox", "Heron", "Lynx", "Wolf",
  "Koala", "Puffin", "Gecko", "Marlin", "Bison", "Raven", "Ibis", "Tapir",
  "Badger", "Dolphin", "Hawk", "Moose", "Seal", "Toucan", "Narwhal", "Yak",
  "Zebra", "Owl", "Crane", "Bear", "Mantis", "Stag",
];

// FNV-1a 32-bit — fast, deterministic; unpredictability comes from the secret.
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface Pseudonym {
  name: string;
  color: string;
}

/**
 * @param authorId   hidden sender's id (used only to seed; never persisted)
 * @param recipientId keeps the codename stable per wall
 * @param secret     server-only salt so codenames can't be reproduced client-side
 */
export function pseudonymFor(
  authorId: string,
  recipientId: string,
  secret: string,
): Pseudonym {
  const h = hash(`${authorId}:${recipientId}:${secret}`);
  const color = COLORS[h % COLORS.length];
  const animal = ANIMALS[Math.floor(h / COLORS.length) % ANIMALS.length];
  return { name: `${color.name} ${animal}`, color: color.hex };
}
