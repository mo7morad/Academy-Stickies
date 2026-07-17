import type { ProfileLink, ProfileSection } from "../../shared/types";
import type { IconName } from "./Icon";
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

  const extractedLinks: ProfileLink[] = [];
  const linkRegex = /https?:\/\/(?:www\.)?(linkedin\.com|github\.com|twitter\.com|x\.com|instagram\.com)\/[^\s)\]"']+/ig;
  
  const extractFrom = (text: string) => {
    if (!text) return;
    const matches = text.match(linkRegex);
    if (matches) {
      for (const rawUrl of matches) {
        const url = rawUrl.endsWith(".") ? rawUrl.slice(0, -1) : rawUrl;
        if (!links.some((l) => l.url === url) && !extractedLinks.some((l) => l.url === url)) {
          let label = "Link";
          const lowerUrl = url.toLowerCase();
          if (lowerUrl.includes("github.com")) label = "GitHub";
          else if (lowerUrl.includes("linkedin.com")) label = "LinkedIn";
          else if (lowerUrl.includes("twitter.com") || lowerUrl.includes("x.com")) label = "Twitter";
          else if (lowerUrl.includes("instagram.com")) label = "Instagram";
          
          extractedLinks.push({ label, url });
        }
      }
    }
  };

  extractFrom(intro);
  sections.forEach((s) => extractFrom(s.body));

  const allLinks = [...links, ...extractedLinks];

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

      {allLinks.length > 0 && (
        <div class="profile__links">
          {allLinks.map((l) => {
            const urlLower = l.url.toLowerCase();
            let iconName: IconName = "globe";
            if (urlLower.includes("github.com")) iconName = "github";
            else if (urlLower.includes("linkedin.com")) iconName = "linkedin";
            else if (urlLower.includes("twitter.com") || urlLower.includes("x.com")) iconName = "twitter";
            else if (urlLower.includes("instagram.com")) iconName = "instagram";

            return (
              <a
                key={l.url}
                class="chip chip--link"
                href={l.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
              >
                <Icon name={iconName} size={13} />
                {l.label}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
