import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
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
    // Only allow drag to dismiss from the header/grabber area to avoid conflict with body scrolling
    const target = e.target as HTMLElement;
    if (!target.closest('.sheet__header') && !target.closest('.sheet__grabber')) {
      return;
    }
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (touchStartY === null) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY;
    
    // If dragging down more than 100px, close it
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
        class="sheet" 
        role="dialog" 
        aria-modal="true" 
        aria-label={title}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
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
