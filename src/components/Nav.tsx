import type { ComponentChildren } from "preact";
import { Icon } from "./Icon";

export function Nav({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ComponentChildren;
}) {
  return (
    <header class="navbar">
      <div class="navbar__bar">
        <div class="navbar__side">
          {onBack && (
            <button class="icon-btn" aria-label="Back" onClick={onBack}>
              <Icon name="back" size={20} />
            </button>
          )}
        </div>
        <div class="navbar__title">
          {title}
          {subtitle && <span class="navbar__subtitle">{subtitle}</span>}
        </div>
        <div class="navbar__side navbar__side--right">{right}</div>
      </div>
    </header>
  );
}
