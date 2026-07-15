import type {
  CreateStickyResult,
  Me,
  RosterMember,
  WallResponse,
} from "../shared/types";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status);
  }
  return (await res.json()) as T;
}

/** Returns the current member, or null if not signed in. */
export async function getMe(): Promise<Me | null> {
  const res = await fetch("/api/me");
  if (res.status === 401) return null;
  return parse<Me>(res);
}

export async function logout(): Promise<void> {
  await fetch("/api/logout", { method: "POST" });
}

export async function requestLink(
  email: string,
): Promise<{ sent: boolean; reason?: string }> {
  const res = await fetch("/api/request-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return parse(res);
}

export async function getMembers(): Promise<RosterMember[]> {
  const data = await parse<{ members: RosterMember[] }>(
    await fetch("/api/members"),
  );
  return data.members;
}

export async function getWall(id: string): Promise<WallResponse> {
  return parse<WallResponse>(await fetch(`/api/members/${id}`));
}

export async function setWallPublic(wallPublic: boolean): Promise<Me> {
  const res = await fetch("/api/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallPublic }),
  });
  return parse<Me>(res);
}

export async function uploadAvatar(file: Blob): Promise<{ avatarUrl: string }> {
  const fd = new FormData();
  fd.append("avatar", file, "avatar.webp");
  return parse(await fetch("/api/me/avatar", { method: "POST", body: fd }));
}

export interface NewSticky {
  recipientId: string;
  describedAs: string;
  goodAt: string;
  isAnonymous: boolean;
  color: string;
  photo?: Blob | null;
}

export async function createSticky(input: NewSticky): Promise<CreateStickyResult> {
  const fd = new FormData();
  fd.append("recipient_id", input.recipientId);
  fd.append("described_as", input.describedAs);
  fd.append("good_at", input.goodAt);
  fd.append("is_anonymous", String(input.isAnonymous));
  fd.append("color", input.color);
  if (input.photo) fd.append("photo", input.photo, "photo.webp");
  return parse<CreateStickyResult>(
    await fetch("/api/stickies", { method: "POST", body: fd }),
  );
}

export async function deleteSticky(id: string): Promise<void> {
  await parse(await fetch(`/api/stickies/${id}`, { method: "DELETE" }));
}
