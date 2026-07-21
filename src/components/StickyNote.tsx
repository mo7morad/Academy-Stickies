import type { Sticky } from "../../shared/types";
import { Icon } from "./Icon";

function rotationFor(id: string): number {
  // Deterministic tiny tilt for an organic, hand-placed feel.
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((h % 5) - 2); // -2deg .. +2deg
}

export function StickyNote({
  sticky,
  subject,
  canDelete,
  onDelete,
}: {
  sticky: Sticky;
  /** Whose wall this is, when it isn't the reader's own. The note was written
   *  to its recipient, so on someone else's wall "describes you as" addressed
   *  the wrong person — their own name goes there instead. A name is also the
   *  one substitution that never guesses at somebody's pronouns. */
  subject?: string | null;
  canDelete?: boolean;
  onDelete?: (id: string) => void;
}) {
  const anon = sticky.isAnonymous;
  const authorLabel = anon
    ? (sticky.authorName ?? "Anonymous")
    : sticky.mine
      ? "You"
      : (sticky.authorName ?? "Someone");

  return (
    <article
      class={`sticky sticky--${sticky.color}`}
      style={`--_rot:${rotationFor(sticky.id)}deg`}
    >
      <div class="sticky__tape" aria-hidden="true" />
      <div class="sticky__body">
        {sticky.describedAs && (
          <div class="sticky__section">
            <div class="sticky__eyebrow">
              describes {subject ?? "you"} as
            </div>
            <p class="sticky__text">{sticky.describedAs}</p>
          </div>
        )}
        {sticky.goodAt && (
          <div class="sticky__section">
            <div class="sticky__eyebrow">great at</div>
            <p class="sticky__text">{sticky.goodAt}</p>
          </div>
        )}
        {sticky.photoUrl && (
          <img class="sticky__photo" src={sticky.photoUrl} alt="" loading="lazy" />
        )}
        <div class="sticky__footer">
          <span class="sticky__author">
            {anon ? (
              <span
                class="sticky__dot"
                style={`background:${sticky.authorColor ?? "currentColor"}`}
                aria-hidden="true"
              />
            ) : (
              <Icon name="person" size={13} />
            )}
            {authorLabel}
          </span>
          {canDelete && (
            <button
              type="button"
              class="sticky__delete"
              aria-label="Remove this sticky"
              onClick={() => onDelete?.(sticky.id)}
            >
              <Icon name="trash" size={15} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
