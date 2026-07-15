// Session + token helpers built on Web Crypto (available in the Workers runtime).
// The session cookie is a stateless, HMAC-signed `${memberId}.${exp}` payload —
// no session table needed, and it's revocable by rotating SESSION_SECRET.

export const COOKIE_NAME = "academy_sid";
export const SESSION_TTL_SECONDS = 180 * 24 * 60 * 60; // 180 days

const encoder = new TextEncoder();

function bytesToB64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(str: string): Uint8Array {
  let s = str.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const binary = atob(s);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** Cryptographically-random URL-safe token (default 256 bits). */
export function randomToken(numBytes = 32): string {
  const buf = new Uint8Array(numBytes);
  crypto.getRandomValues(buf);
  return bytesToB64url(buf);
}

/** UUID for row ids / R2 keys. */
export function newId(): string {
  return crypto.randomUUID();
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function sign(secret: string, data: string): Promise<string> {
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return bytesToB64url(new Uint8Array(sig));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

export interface Session {
  value: string;
  maxAge: number;
}

/** Build a signed session cookie value for the given member. */
export async function createSession(
  memberId: string,
  secret: string,
  ttlSeconds = SESSION_TTL_SECONDS,
): Promise<Session> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${memberId}.${exp}`;
  const sig = await sign(secret, payload);
  const value = `${bytesToB64url(encoder.encode(payload))}.${sig}`;
  return { value, maxAge: ttlSeconds };
}

/** Verify a session cookie; returns the memberId if valid & unexpired, else null. */
export async function verifySession(
  cookieValue: string,
  secret: string,
): Promise<string | null> {
  const parts = cookieValue.split(".");
  if (parts.length !== 2) return null;
  let payload: string;
  try {
    payload = new TextDecoder().decode(b64urlToBytes(parts[0]));
  } catch {
    return null;
  }
  const expectedSig = await sign(secret, payload);
  if (!timingSafeEqual(expectedSig, parts[1])) return null;

  const [memberId, expStr] = payload.split(".");
  const exp = Number(expStr);
  if (!memberId || !Number.isFinite(exp)) return null;
  if (exp < Math.floor(Date.now() / 1000)) return null;
  return memberId;
}
