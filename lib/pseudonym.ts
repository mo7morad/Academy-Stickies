// Random codenames for anonymous stickies, e.g. "Pink Leopard".

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
  { name: "Crimson", hex: "#DC143C" },
  { name: "Plum", hex: "#DDA0DD" },
  { name: "Emerald", hex: "#50C878" },
  { name: "Ruby", hex: "#E0115F" },
  { name: "Azure", hex: "#007FFF" },
  { name: "Magenta", hex: "#FF00FF" },
  { name: "Cyan", hex: "#00FFFF" },
  { name: "Onyx", hex: "#353839" },
  { name: "Sapphire", hex: "#0F52BA" },
  { name: "Mint", hex: "#3EB489" },
  { name: "Lilac", hex: "#C8A2C8" },
  { name: "Copper", hex: "#B87333" },
  { name: "Bronze", hex: "#CD7F32" },
  { name: "Silver", hex: "#C0C0C0" }
];

const ANIMALS = [
  "Leopard", "Otter", "Falcon", "Panda", "Fox", "Heron", "Lynx", "Wolf",
  "Koala", "Puffin", "Gecko", "Marlin", "Bison", "Raven", "Ibis", "Tapir",
  "Badger", "Dolphin", "Hawk", "Moose", "Seal", "Toucan", "Narwhal", "Yak",
  "Zebra", "Owl", "Crane", "Bear", "Mantis", "Stag", "Tiger", "Lion",
  "Elephant", "Giraffe", "Rhino", "Hippo", "Kangaroo", "Penguin", "Ostrich",
  "Peacock", "Shark", "Whale", "Octopus", "Squid", "Crab", "Lobster",
  "Butterfly", "Moth", "Bee", "Dragonfly", "Frog", "Toad", "Salamander",
  "Snake", "Lizard", "Turtle", "Crocodile", "Alligator", "Dinosaur", "Dragon",
  "Unicorn", "Phoenix", "Griffin", "Sphinx", "Pegasus", "Minotaur", "Centaur",
  "Mermaid", "Kraken", "Yeti", "Sasquatch", "Platypus", "Echidna", "Wombat",
  "Wallaby", "Quokka", "Dingo", "Emu", "Cassowary", "Kiwi", "Cheetah",
  "Jaguar", "Panther", "Cougar", "Puma", "Bobcat", "Ocelot"
];

export interface Pseudonym {
  name: string;
  color: string;
}

export function pseudonymFor(): Pseudonym {
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return { name: `${color.name} ${animal}`, color: color.hex };
}
