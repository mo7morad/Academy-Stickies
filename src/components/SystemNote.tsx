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

  if (dismissed) return null;

  function dismiss() {
    // A full storage quota shouldn't leave the note stuck on screen — hiding
    // it for this session is still better than ignoring the click.
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  return (
    <div class="system-note">
      <div class="system-note__icon">
        <Icon name="sparkles" size={24} />
      </div>
      <div class="system-note__content">
        <h3>Hey there!</h3>
        <p>Wishing you all a wonderful and memorable time at the academy! 🌟</p>
        <p>
          Stickies is made to cheer each other on, leave a kind message, or share
          something you’d like others to notice. You never know when a few words of
          encouragement can brighten someone’s day! 💛
        </p>
        <p>
          Have fun, connect with one another, and make the most of your time here! ✨
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
