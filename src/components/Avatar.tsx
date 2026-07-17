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
  size = "md",
  eager = false,
}: {
  name: string;
  url: string | null;
  size?: Size;
  /** Set on the handful of avatars above the fold; everything else lazy-loads. */
  eager?: boolean;
}) {
  const px = PX[size];
  return (
    <div class={`avatar avatar--${size}`} aria-hidden="true">
      {url ? (
        <img
          src={url}
          alt=""
          width={px}
          height={px}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
        />
      ) : (
        <span>{initials(name)}</span>
      )}
    </div>
  );
}
