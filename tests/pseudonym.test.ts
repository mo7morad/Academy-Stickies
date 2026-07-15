import { describe, expect, it } from "vitest";
import { pseudonymFor } from "../lib/pseudonym";

describe("pseudonymFor", () => {
  it("produces a <Color> <Animal> name and a hex accent", () => {
    const p = pseudonymFor("author-1", "recipient-1", "secret");
    expect(p.name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
    expect(p.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("is stable per (author, recipient, secret)", () => {
    const a = pseudonymFor("author-1", "recipient-1", "secret");
    const b = pseudonymFor("author-1", "recipient-1", "secret");
    expect(a).toEqual(b);
  });

  it("differs across recipients (same sender looks different per wall)", () => {
    const a = pseudonymFor("author-1", "recipient-1", "secret");
    const b = pseudonymFor("author-1", "recipient-2", "secret");
    expect(a.name === b.name && a.color === b.color).toBe(false);
  });

  it("can't be reproduced without the server secret", () => {
    const withSecret = pseudonymFor("author-1", "recipient-1", "server-secret");
    const guessed = pseudonymFor("author-1", "recipient-1", "");
    expect(withSecret.name).not.toBe(guessed.name);
  });
});
