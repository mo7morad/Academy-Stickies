import { useState } from "preact/hooks";
import { Icon } from "./Icon";

/** Bumped when the message changes, so an edited note shows again to people
 *  who dismissed the previous one. */
const STORAGE_KEY = "systemNoteDismissed:v1";

/**
 * The academy's welcome note, above every wall. It's the same message on every
 * page, so it has to be dismissible — once read, it's just something to scroll
 * past. The dismissal is local to the browser and permanent.
 */
export function SystemNote() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(STORAGE_KEY) === "1",
  );
  const [leaving, setLeaving] = useState(false);

  if (dismissed) return null;

  function dismiss() {
    // A full storage quota shouldn't leave the note stuck on screen — hiding
    // it for this session is still better than ignoring the click.
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    // The unmount waits for the lift-off animation, which reduced-motion
    // shortens to a tick rather than removing — so it always arrives.
    setLeaving(true);
  }

  return (
    <div
      class={`system-note${leaving ? " system-note--leaving" : ""}`}
      role="note"
      onAnimationEnd={(e) => {
        if (leaving && e.currentTarget === e.target) setDismissed(true);
      }}
    >
      <div class="system-note__icon">
        <Icon name="sparkles" size={24} />
      </div>
      <div class="system-note__content">
        {/* The trailing emoji are joined with a non-breaking space: on their
            own they wrap to a line of their own and read as a stray glyph. */}
        <h3>Hey there!</h3>
        <p>Wishing you all a wonderful and memorable time at the academy!{"\u00A0🌟"}</p>
        <p>
          Stickies is made to cheer each other on, leave a kind message, or share
          something you’d like others to notice. You never know when a few words of
          encouragement can brighten someone’s day!{"\u00A0💛"}
        </p>
        <p>
          Have fun, connect with one another, and make the most of your time
          here!{"\u00A0✨"}
        </p>
      </div>
      <button
        type="button"
        class="system-note__dismiss"
        aria-label="Dismiss this note"
        onClick={dismiss}
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
