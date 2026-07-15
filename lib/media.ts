// Upload validation helpers for avatars + sticky photos.

export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8 MB

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

export function validateImage(file: File, maxBytes: number): ValidationResult {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { ok: false, error: "Unsupported image type (use PNG, JPEG, or WebP)." };
  }
  if (file.size === 0) {
    return { ok: false, error: "Empty file." };
  }
  if (file.size > maxBytes) {
    return { ok: false, error: `Image too large (max ${Math.round(maxBytes / 1024 / 1024)} MB).` };
  }
  return { ok: true };
}

export function extForType(type: string): string {
  switch (type) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}
