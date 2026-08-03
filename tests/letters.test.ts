import { describe, expect, it } from "vitest";
import { letterNotificationTemplate } from "../lib/email";
import {
  LETTER_STYLES,
  MAX_LETTER_BODY_LEN,
  MAX_LETTER_SUBJECT_LEN,
} from "../shared/types";

describe("Envelope Letters", () => {
  it("contains all 5 supported paper styles", () => {
    expect(LETTER_STYLES).toEqual(["classic", "kraft", "rose", "midnight", "sage"]);
  });

  it("defines appropriate field limits", () => {
    expect(MAX_LETTER_BODY_LEN).toBe(4000);
    expect(MAX_LETTER_SUBJECT_LEN).toBe(120);
  });

  it("renders email notification template for letters", () => {
    const tmpl = letterNotificationTemplate(
      "Jane",
      "Pink Panther",
      "https://example.com/me",
    );
    expect(tmpl.subject).toContain("sealed letter");
    expect(tmpl.html).toContain("Pink Panther");
    expect(tmpl.html).toContain("https://example.com/me");
    expect(tmpl.text).toContain("Jane");
  });
});
