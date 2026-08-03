import { createPortal } from "preact/compat";
import { useEffect } from "preact/hooks";
import { Icon } from "./Icon";

export function ImageModal({
  src,
  alt,
  title,
  onClose,
}: {
  src: string;
  alt?: string;
  title?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      class="avatar-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title || alt || "Full size photo"}
    >
      <div class="avatar-modal-card">
        <div class="avatar-modal-header">
          {title && <h3 class="avatar-modal-title">{title}</h3>}
          <button
            class="icon-btn avatar-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        <div class="avatar-modal-body">
          <img
            src={src}
            alt={alt || title || ""}
            class="avatar-modal-img"
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
