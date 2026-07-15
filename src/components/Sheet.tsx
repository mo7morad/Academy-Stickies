import type { ComponentChildren } from "preact";
import { useEffect } from "preact/hooks";
import { Icon } from "./Icon";

export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ComponentChildren;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <>
      <div class="scrim" onClick={onClose} />
      <div class="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div class="sheet__grabber" />
        <div class="sheet__header">
          <div class="sheet__title">{title}</div>
          <button class="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="close" size={20} />
          </button>
        </div>
        <div class="sheet__body">{children}</div>
      </div>
    </>
  );
}
