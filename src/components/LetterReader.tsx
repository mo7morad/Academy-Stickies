import { useEffect, useState } from "preact/hooks";
import type { Letter, Me } from "../../shared/types";
import { markLetterOpened } from "../api";
import { Icon } from "./Icon";
import { ImageModal } from "./ImageModal";
import { Markdown } from "./Markdown";

export function LetterReader({
  letter,
  me,
  onClose,
  onDelete,
}: {
  letter: Letter;
  me: Me;
  onClose?: () => void;
  onDelete: (id: string) => void;
}) {
  useEffect(() => {
    if (!letter.isOpened && letter.recipientId === me.id) {
      markLetterOpened(letter.id).catch(console.error);
    }
  }, [letter.id, letter.isOpened, letter.recipientId, me.id]);

  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const anon = letter.isAnonymous;
  const authorLabel = anon
    ? (letter.authorName ?? "Anonymous")
    : letter.mine
      ? "You"
      : (letter.authorName ?? "Someone");

  const formattedDate = new Date(letter.createdAt).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div class={`letter-reader letter-reader--${letter.paperStyle}`}>
      <div class="letter-paper animate-paper-unfold">
        {/* Metal Paperclip Accent */}
        <div class="letter-paper__clip" aria-hidden="true">
          <svg viewBox="0 0 24 48" class="letter-paper__clip-svg">
            <path
              d="M8 10 v22 a6 6 0 0 0 12 0 v-26 a9 9 0 0 0 -18 0 v28 a12 12 0 0 0 24 0 v-22"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
            />
          </svg>
        </div>

        {/* Top Right Close Button */}
        {onClose && (
          <button
            type="button"
            class="letter-paper__close-btn"
            aria-label="Close letter"
            onClick={onClose}
          >
            <Icon name="close" size={18} />
          </button>
        )}

        {/* Realistic Envelope Fold Creases */}
        <div class="letter-paper__fold-top" aria-hidden="true" />
        <div class="letter-paper__fold-bottom" aria-hidden="true" />

        {/* Stationery Margin Line */}
        <div class="letter-paper__margin-line" aria-hidden="true" />

        {/* Date Display */}
        <div class="letter-paper__top-meta">
          <span class="letter-paper__date">{formattedDate}</span>
        </div>

        {/* Subject Heading */}
        {letter.subject && (
          <h2 class="letter-paper__subject">{letter.subject}</h2>
        )}

        {/* Actual Letter Body Text */}
        <main class="letter-paper__body">
          <Markdown text={letter.body} />
        </main>

        {/* Signature Line */}
        <div class="letter-paper__signature">
          <span class="letter-paper__sig-line">— {authorLabel}</span>
        </div>

        {/* Enclosed Photo Attachment */}
        {letter.photoUrl && (
          <div class="letter-paper__photo-container">
            <img
              class="letter-paper__photo letter-paper__photo--zoomable"
              src={letter.photoUrl}
              alt="Enclosed Photograph"
              loading="lazy"
              onClick={(e) => {
                e.stopPropagation();
                setShowPhotoModal(true);
              }}
            />
            {showPhotoModal && (
              <ImageModal
                src={letter.photoUrl}
                alt="Enclosed Photograph"
                onClose={() => setShowPhotoModal(false)}
              />
            )}
          </div>
        )}

        {/* Subtle, Low-Key Delete / Retract Action */}
        <footer class="letter-paper__footer">
          <button
            type="button"
            class="letter-paper__delete-btn"
            title={letter.mine ? "Retract Letter" : "Delete Letter"}
            onClick={() => onDelete(letter.id)}
          >
            <Icon name="trash" size={12} />
            <span>{letter.mine ? "Retract" : "Delete"}</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
