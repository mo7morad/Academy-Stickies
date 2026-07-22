import { describe, expect, it } from "vitest";
import { PROFILE_LIMITS, sanitizeProfileInput } from "../shared/profile";

/** Convenience: assert success and hand back the sanitized value. */
function ok(raw: unknown) {
  const r = sanitizeProfileInput(raw);
  if (!r.ok) throw new Error(`expected ok, got error: ${r.error}`);
  return r.value;
}

describe("sanitizeProfileInput — name", () => {
  it("requires a non-empty name", () => {
    const r = sanitizeProfileInput({ name: "   " });
    expect(r.ok).toBe(false);
  });

  it("strips tags from the name (it renders raw)", () => {
    expect(ok({ name: "<script>alert(1)</script>Aileen" }).name).toBe(
      "alert(1) Aileen",
    );
  });

  it("caps an over-long name", () => {
    expect(ok({ name: "A".repeat(200) }).name.length).toBe(PROFILE_LIMITS.name);
  });
});

describe("sanitizeProfileInput — links", () => {
  it("rejects a javascript: URL by dropping the row", () => {
    const v = ok({
      name: "A",
      links: [{ label: "x", url: "javascript:alert(1)" }],
    });
    expect(v.links).toEqual([]);
  });

  it("keeps a valid https link", () => {
    const v = ok({
      name: "A",
      links: [{ label: "GitHub", url: "https://github.com/me" }],
    });
    expect(v.links).toEqual([{ label: "GitHub", url: "https://github.com/me" }]);
  });

  it("falls back to the host when a link has no label", () => {
    const v = ok({
      name: "A",
      links: [{ label: "", url: "https://www.linkedin.com/in/me" }],
    });
    expect(v.links[0].label).toBe("linkedin.com");
  });

  it("drops a link with a blank URL", () => {
    const v = ok({ name: "A", links: [{ label: "Empty", url: "" }] });
    expect(v.links).toEqual([]);
  });

  it("caps the number of links", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      label: `L${i}`,
      url: `https://example.com/${i}`,
    }));
    expect(ok({ name: "A", links: many }).links.length).toBe(
      PROFILE_LIMITS.links,
    );
  });
});

describe("sanitizeProfileInput — sections", () => {
  it("drops a section that is blank in both fields", () => {
    const v = ok({
      name: "A",
      sections: [
        { title: "", body: "" },
        { title: "About", body: "Hello" },
      ],
    });
    expect(v.sections).toEqual([{ title: "About", body: "Hello" }]);
  });

  it("normalizes prose in a section body the way the import does", () => {
    // The break token survives; every other tag is removed.
    const v = ok({
      name: "A",
      sections: [{ title: "T", body: "**Tools**<br/>Figma <u>x</u>" }],
    });
    expect(v.sections[0].body).toBe("**Tools**<br>Figma x");
  });

  it("strips tags from a section title (it renders raw)", () => {
    const v = ok({
      name: "A",
      sections: [{ title: "<b>Goals</b>", body: "x" }],
    });
    expect(v.sections[0].title).toBe("Goals");
  });

  it("caps the number of sections", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      title: `S${i}`,
      body: "b",
    }));
    expect(ok({ name: "A", sections: many }).sections.length).toBe(
      PROFILE_LIMITS.sections,
    );
  });
});

describe("sanitizeProfileInput — shape", () => {
  it("tolerates missing and malformed fields", () => {
    const v = ok({ name: "A", sections: "nope", links: 5, tagline: 7 });
    expect(v.tagline).toBe("");
    expect(v.sections).toEqual([]);
    expect(v.links).toEqual([]);
  });
});
