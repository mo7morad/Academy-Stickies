import { describe, expect, it } from "vitest";
import {
  normalizeBreaks,
  normalizeProse,
  stripTags,
  toTagline,
} from "../shared/text";

describe("normalizeBreaks", () => {
  it("turns a single break into the token, not literal markup", () => {
    // The label/value grid several authors built out of <br/>.
    expect(normalizeBreaks("**Tools**<br/>Figma • Miro • Jira")).toBe(
      "**Tools**<br>Figma • Miro • Jira",
    );
  });

  it("accepts every spelling authors used", () => {
    for (const tag of ["<br>", "<br/>", "<br />", "<BR/>", "<br  />"]) {
      expect(normalizeBreaks(`a${tag}b`)).toBe("a<br>b");
    }
  });

  it("splits a run of breaks into a paragraph", () => {
    expect(normalizeBreaks("I love chess.<br/><br/>I love running.")).toBe(
      "I love chess.\n\nI love running.",
    );
  });

  it("treats breaks separated by spaces as one run", () => {
    expect(normalizeBreaks("- Sales & problem-solving<br/> <br/>Next")).toBe(
      "- Sales & problem-solving\n\nNext",
    );
  });

  it("drops breaks that only pad the ends of a block", () => {
    expect(normalizeBreaks("<br/>Solo line<br/>")).toBe("Solo line");
    expect(normalizeBreaks("- Sales & problem-solving<br/> <br/>")).toBe(
      "- Sales & problem-solving",
    );
  });

  it("keeps a break that ends a line mid-block", () => {
    // Here the trailing break is load-bearing: without it the two lines soft-wrap
    // together into one.
    expect(normalizeBreaks("**Product**<br/>Research<br/>\n**Tools**<br/>Figma")).toBe(
      "**Product**<br>Research<br>\n**Tools**<br>Figma",
    );
  });

  it("leaves prose without breaks alone", () => {
    expect(normalizeBreaks("Just a sentence.\n\nAnd another.")).toBe(
      "Just a sentence.\n\nAnd another.",
    );
  });
});

describe("normalizeProse", () => {
  it("keeps the break token for Markdown to draw", () => {
    expect(normalizeProse("**Tools**<br/>Figma")).toBe("**Tools**<br>Figma");
  });

  it("removes tags Markdown has no syntax for, keeping the words", () => {
    // Beatrice_Wambui reached for <u> because Markdown has no underline.
    expect(normalizeProse("<u>*PS: I undersell Myself on Strengths!*</u>")).toBe(
      "*PS: I undersell Myself on Strengths!*",
    );
  });

  it("removes an unknown tag rather than showing it", () => {
    expect(normalizeProse("a <mark>b</mark> c")).toBe("a b c");
  });

  it("keeps prose untouched", () => {
    expect(normalizeProse("Plain sentence, 3 < 5 and <3.")).toBe(
      "Plain sentence, 3 < 5 and <3.",
    );
  });
});

describe("stripTags", () => {
  it("removes tags from text that renders raw", () => {
    expect(stripTags("Design<br/>Student")).toBe("Design Student");
  });

  it("does not eat comparisons or emoticons", () => {
    expect(stripTags("a < b and <3")).toBe("a < b and <3");
  });
});

describe("toTagline", () => {
  it("skips a greeting to reach the real sentence", () => {
    // Aditya_Fahmi_Syahriza — used to render as "Hi!".
    const t = toTagline(
      "Hi! My name is Adit! I'm an Architecture graduate and I also do graphic designing.",
    );
    expect(t).not.toMatch(/^Hi!/);
    expect(t).toContain("Architecture graduate");
  });

  it("keeps a greeting when it is all they wrote", () => {
    expect(toTagline("Namasteee!")).toBe("Namasteee!");
  });

  it("keeps reading until the line says something", () => {
    // Abigail_Metanoia_Melody — "Design Student" alone is a thin card.
    expect(toTagline("Design Student. I love building things for people.")).toBe(
      "Design Student. I love building things for people.",
    );
  });

  it("strips authored markup rather than showing it", () => {
    expect(toTagline("**Tools**<br/>Figma • Miro • Jira")).not.toContain("<br");
  });

  it("caps long prose without cutting mid-word", () => {
    const t = toTagline("A".repeat(40) + " " + "B".repeat(200));
    expect(t.length).toBeLessThanOrEqual(121);
    expect(t.endsWith("…")).toBe(true);
    expect(t).not.toMatch(/B{5}…$/);
  });

  it("returns empty for empty input", () => {
    expect(toTagline("   ")).toBe("");
  });
});
