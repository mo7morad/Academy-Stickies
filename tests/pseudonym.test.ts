import { describe, expect, it } from "vitest";
import { pseudonymFor } from "../lib/pseudonym";

describe("pseudonymFor", () => {
  it("produces a <Color> <Animal> name and a hex accent", () => {
    const p = pseudonymFor();
    expect(p.name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
    expect(p.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  // Codenames are drawn fresh per sticky, so the same author looks like a
  // different stranger on every note they leave. Over this many draws, one
  // repeated pair would mean the randomness isn't there at all.
  it("varies between stickies", () => {
    const seen = new Set(
      Array.from({ length: 50 }, () => {
        const p = pseudonymFor();
        return `${p.name} ${p.color}`;
      }),
    );
    expect(seen.size).toBeGreaterThan(1);
  });

  it("pairs each color word with its own hex", () => {
    const byWord = new Map<string, string>();
    for (let i = 0; i < 200; i++) {
      const { name, color } = pseudonymFor();
      const word = name.split(" ")[0];
      const known = byWord.get(word);
      if (known) expect(color).toBe(known);
      else byWord.set(word, color);
    }
  });
});
