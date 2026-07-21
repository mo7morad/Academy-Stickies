import { Icon } from "./Icon";

export function SystemNote() {
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
    </div>
  );
}
