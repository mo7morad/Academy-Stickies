import type { Letter } from "../../shared/types";
import { Icon } from "./Icon";

function rotationFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((h % 5) - 2); // -2deg .. +2deg subtle tilt
}

export function Envelope({
  letter,
  onClick,
}: {
  letter: Letter;
  onClick: () => void;
  canDelete?: boolean;
  onDelete?: (id: string, e: Event) => void;
}) {
  const anon = letter.isAnonymous;
  const authorLabel = anon
    ? (letter.authorName ?? "Anonymous")
    : letter.mine
      ? "You"
      : (letter.authorName ?? "Someone");

  const formattedDate = new Date(letter.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return (
    <article
      class={`envelope envelope--${letter.paperStyle} ${
        letter.isOpened ? "envelope--opened" : "envelope--sealed"
      }`}
      style={`--_rot:${rotationFor(letter.id)}deg`}
      onClick={onClick}
      tabIndex={0}
      role="button"
      aria-label={`${letter.isOpened ? "Opened" : "Sealed"} envelope letter from ${authorLabel}. ${
        letter.subject ? `Subject: ${letter.subject}` : ""
      }`}
    >
      {/* Flap & Wax Seal Header */}
      <div class="envelope__top-flap">
        <svg class="envelope__flap-svg" viewBox="0 0 100 48" preserveAspectRatio="none">
          <polygon points="0,0 100,0 50,46" class="envelope__flap-polygon" />
        </svg>

        {/* Embossed Wax Seal */}
        <div class="envelope__wax-seal" title={letter.isOpened ? "Opened" : "Sealed Wax Stamp"}>
          <div class="envelope__wax-ring">
            <span class="envelope__wax-emblem">
              {letter.isOpened ? "📜" : "⚜️"}
            </span>
          </div>
        </div>
      </div>

      {/* Main Envelope Body */}
      <div class="envelope__body">
        {/* Serrated Postage Stamp */}
        <div class="envelope__postage-stamp">
          <div class="envelope__stamp-border">
            <span class="envelope__stamp-symbol">📮</span>
          </div>
          <div class="envelope__postmark-lines" aria-hidden="true">
            <div class="envelope__postmark-circle">AIR MAIL</div>
          </div>
        </div>

        {/* Envelope Face Information */}
        <div class="envelope__face">
          <div class="envelope__subject-wrap">
            {letter.subject ? (
              <h3 class="envelope__subject-title">{letter.subject}</h3>
            ) : (
              <div class="envelope__subject-placeholder">Confidential Letter</div>
            )}
          </div>

          <div class="envelope__footer">
            <span class="envelope__author-tag">
              {anon ? (
                <span
                  class="envelope__anon-dot"
                  style={`background:${letter.authorColor ?? "var(--brand)"}`}
                  aria-hidden="true"
                />
              ) : (
                <Icon name="person" size={13} />
              )}
              <span class="envelope__author-name">{authorLabel}</span>
            </span>

            <span class="envelope__date-tag">{formattedDate}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
