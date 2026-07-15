import { Icon } from "./Icon";

export function HeaderActions({
  theme,
  onToggleTheme,
  onLogout,
}: {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onLogout?: () => void;
}) {
  return (
    <>
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
