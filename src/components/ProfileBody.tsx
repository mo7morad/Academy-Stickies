import { stripTags } from "../../shared/text";
import type { ProfileLink, ProfileSection } from "../../shared/types";
import { resolveProfileLinks } from "../lib/links";
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
  showLinks = true,
}: {
  intro: string;
  sections: ProfileSection[];
  links: ProfileLink[];
  skills?: string[];
  /** The wall hero shows the links itself, so it turns them off down here. */
  showLinks?: boolean;
}) {
  const empty = !intro.trim() && sections.length === 0;
  const resolved = showLinks
    ? resolveProfileLinks({ intro, sections, links })
    : [];

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

      {/* Bodies get cleaned by Markdown; a title is rendered as-is, so it
          needs the same guard against whatever the author typed. */}
      {sections.map((s) => (
        <section key={s.title} class="profile__section">
          <h3 class="profile__heading">{stripTags(s.title)}</h3>
          <Markdown text={s.body} />
        </section>
      ))}

      {empty && (
        <p class="profile__empty">
          They haven't written their profile yet — say hello with a sticky instead.
        </p>
      )}

      {resolved.length > 0 && (
        <div class="profile__links">
          {resolved.map((l) => (
            <a
              key={l.url}
              class="chip chip--link"
              href={l.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
            >
              <Icon name={l.icon} size={13} />
              {l.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
