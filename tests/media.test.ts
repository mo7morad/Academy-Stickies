import { describe, expect, it } from "vitest";
import { MAX_AVATAR_BYTES, validateImage } from "../lib/media";
import { emailConfigured, magicLinkTemplate } from "../lib/email";

function fakeFile(type: string, size: number): File {
  return new File([new Uint8Array(size)], "x", { type });
}

describe("validateImage", () => {
  it("accepts a small png", () => {
    expect(validateImage(fakeFile("image/png", 1024), MAX_AVATAR_BYTES).ok).toBe(true);
  });
  it("rejects a non-image type", () => {
    expect(validateImage(fakeFile("application/pdf", 1024), MAX_AVATAR_BYTES).ok).toBe(false);
  });
  it("rejects an oversized image", () => {
    expect(
      validateImage(fakeFile("image/png", MAX_AVATAR_BYTES + 1), MAX_AVATAR_BYTES).ok,
    ).toBe(false);
  });
  it("rejects an empty file", () => {
    expect(validateImage(fakeFile("image/png", 0), MAX_AVATAR_BYTES).ok).toBe(false);
  });
});

describe("email config", () => {
  it("is false when incomplete", () => {
    expect(emailConfigured({})).toBe(false);
    expect(emailConfigured({ CF_ACCOUNT_ID: "a", CF_EMAIL_API_TOKEN: "b" })).toBe(false);
  });
  it("is true when complete", () => {
    expect(
      emailConfigured({
        CF_ACCOUNT_ID: "a",
        CF_EMAIL_API_TOKEN: "b",
        EMAIL_FROM: "x@y.com",
      }),
    ).toBe(true);
  });
  it("escapes html in the magic-link template", () => {
    const { html } = magicLinkTemplate("<b>Al</b>", "https://x/api/auth?token=abc&x=1");
    expect(html).not.toContain("<b>Al</b>");
    expect(html).toContain("&amp;");
  });
});
