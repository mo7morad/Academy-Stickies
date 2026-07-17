import type { ProfileLink, ProfileSection } from "../../shared/types";
import { Icon } from "./Icon";
import { Markdown } from "./Markdown";

/**
 * The readable body of a cohort profile — shared by learners and mentors so
 * both read the same way. Section titles and order are the author's own.
 */
export function ProfileBody({
  intro,
  sections,
  links,
  skills,
}: {
  intro: string;
  sections: ProfileSection[];
  links: ProfileLink[];
  skills?: string[];
}) {
  const empty = !intro.trim() && sections.length === 0;

  return (
    <div class="profile">
      {skills && skills.length > 0 && (
        <div class="profile__skills">
          {skills.map((s) => (
            <span key={s} class="chip">
              {s}
            </span>
          ))}
        </div>
      )}

      {intro.trim() && (
        <div class="profile__intro">
          <Markdown text={intro} />
        </div>
      )}

      {sections.map((s) => (
        <section key={s.title} class="profile__section">
          <h3 class="profile__heading">{s.title}</h3>
          <Markdown text={s.body} />
        </section>
      ))}

      {empty && (
        <p class="profile__empty">
          They haven't written their profile yet — say hello with a sticky instead.
        </p>
      )}

      {links.length > 0 && (
        <div class="profile__links">
          {links.map((l) => (
            <a
              key={l.url}
              class="chip chip--link"
              href={l.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
            >
              <Icon name="globe" size={13} />
              {l.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
