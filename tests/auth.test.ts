import { describe, expect, it } from "vitest";
import {
  createSession,
  randomToken,
  verifySession,
} from "../lib/auth";

const SECRET = "test-secret-please-ignore";

describe("session cookie", () => {
  it("round-trips a valid session", async () => {
    const { value } = await createSession("member-123", SECRET);
    const id = await verifySession(value, SECRET);
    expect(id).toBe("member-123");
  });

  it("rejects a tampered payload", async () => {
    const { value } = await createSession("member-123", SECRET);
    const [payload, sig] = value.split(".");
    // Flip the last char of the signed payload.
    const tampered = `${payload}x.${sig}`;
    expect(await verifySession(tampered, SECRET)).toBeNull();
  });

  it("rejects a wrong secret (revocation by rotation)", async () => {
    const { value } = await createSession("member-123", SECRET);
    expect(await verifySession(value, "different-secret")).toBeNull();
  });

  it("rejects an expired session", async () => {
    const { value } = await createSession("member-123", SECRET, -10);
    expect(await verifySession(value, SECRET)).toBeNull();
  });

  it("rejects malformed cookies", async () => {
    expect(await verifySession("garbage", SECRET)).toBeNull();
    expect(await verifySession("a.b.c", SECRET)).toBeNull();
  });
});

describe("randomToken", () => {
  it("is url-safe and high-entropy", () => {
    const t = randomToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(t.length).toBeGreaterThanOrEqual(40);
    expect(randomToken()).not.toBe(t);
  });
});
