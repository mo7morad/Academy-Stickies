import { useState } from "preact/hooks";
import { ImageModal } from "./ImageModal";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

type Size = "sm" | "md" | "lg" | "xl" | "xxl";

// Kept in sync with .avatar--* in components.css so the <img> can carry real
// dimensions — 200+ faces load on the roster and none of them may shift layout.
const PX: Record<Size, number> = { sm: 34, md: 46, lg: 66, xl: 104, xxl: 132 };

export function Avatar({
  name,
  url,
  fullUrl,
  size = "md",
  eager = false,
  zoomable = true,
}: {
  name: string;
  url: string | null;
  /** Full resolution image URL if different from `url` (e.g. avatarUrl vs thumbUrl). */
  fullUrl?: string | null;
  size?: Size;
  /** Set on the handful of avatars above the fold; everything else lazy-loads. */
  eager?: boolean;
  /** Enable clicking to open full-size image viewer modal. Defaults to true. */
  zoomable?: boolean;
}) {
  const [showFull, setShowFull] = useState(false);
  const px = PX[size];
  const imageSrc = fullUrl || url;
  const isZoomable = zoomable && !!imageSrc;

  const handleClick = (e: MouseEvent) => {
    if (isZoomable) {
      e.preventDefault();
      e.stopPropagation();
      setShowFull(true);
    }
  };

  return (
    <>
      <div
        class={`avatar avatar--${size} ${isZoomable ? "avatar--zoomable" : ""}`}
        aria-hidden={isZoomable ? undefined : "true"}
        role={isZoomable ? "button" : undefined}
        tabIndex={isZoomable ? 0 : undefined}
        aria-label={isZoomable ? `View ${name || "profile"}'s photo` : undefined}
        onClick={handleClick}
        onKeyDown={(e: KeyboardEvent) => {
          if (isZoomable && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            e.stopPropagation();
            setShowFull(true);
          }
        }}
      >
        {url ? (
          <img
            src={url}
            alt={name || ""}
            width={px}
            height={px}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
          />
        ) : (
          <span>{initials(name)}</span>
        )}
      </div>

      {showFull && imageSrc && (
        <ImageModal
          src={imageSrc}
          alt={name}
          title={name}
          onClose={() => setShowFull(false)}
        />
      )}
    </>
  );
}

