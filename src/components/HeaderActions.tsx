import { navigate } from "../router";
import { Icon } from "./Icon";

export function HeaderActions({
  theme,
  onToggleTheme,
  onLogout,
  unreadCount = 0,
}: {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onLogout?: () => void;
  /** New notes waiting on your wall — draws the red notification dot. */
  unreadCount?: number;
}) {
  const hasUnread = unreadCount > 0;
  return (
    <>
      <button
        class="icon-btn icon-btn--bell"
        aria-label={
          hasUnread
            ? `Your wall — ${unreadCount} new note${unreadCount === 1 ? "" : "s"}`
            : "Your wall"
        }
        onClick={() => navigate("/me")}
      >
        <Icon name="bell" size={20} />
        {hasUnread && (
          <span class="notif-badge" aria-hidden="true">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      <button
        class="icon-btn"
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        onClick={onToggleTheme}
      >
        <Icon name={theme === "dark" ? "sun" : "moon"} size={20} />
      </button>
      {onLogout && (
        <button class="icon-btn" aria-label="Sign out" onClick={onLogout}>
          <Icon name="logout" size={20} />
        </button>
      )}
    </>
  );
}
