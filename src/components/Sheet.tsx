import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import { Icon } from "./Icon";

export function Sheet({
  title,
  onClose,
  children,
  variant = "default",
}: {
  title: string;
  onClose: () => void;
  children: ComponentChildren;
  variant?: "default" | "bare";
}) {
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

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

  const handleTouchStart = (e: TouchEvent) => {
    if (variant === "bare") return;
    const target = e.target as HTMLElement;
    if (!target.closest('.sheet__header') && !target.closest('.sheet__grabber')) {
      return;
    }
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (touchStartY === null || variant === "bare") return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY;
    
    if (diff > 100) {
      onClose();
      setTouchStartY(null);
    }
  };

  const handleTouchEnd = () => {
    setTouchStartY(null);
  };

  return (
    <>
      <div class="scrim" onClick={onClose} />
      <div 
        class={`sheet ${variant === "bare" ? "sheet--bare" : ""}`} 
        role="dialog" 
        aria-modal="true" 
        aria-label={title}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {variant !== "bare" && (
          <>
            <div class="sheet__grabber" />
            <div class="sheet__header">
              <div class="sheet__title">{title}</div>
              <button class="icon-btn" aria-label="Close" onClick={onClose}>
                <Icon name="close" size={20} />
              </button>
            </div>
          </>
        )}
        <div class="sheet__body">{children}</div>
      </div>
    </>
  );
}
