import { useEffect, useMemo, useState } from "preact/hooks";
import { stripTags } from "../../shared/text";
import type { Mentor } from "../../shared/types";
import { getMentors } from "../api";
import { Avatar } from "../components/Avatar";
import { Spinner } from "../components/controls";
import { navigate } from "../router";
import { useToast } from "../toast";

/**
 * The mentor directory. Mentors ("seniors") are full members — they sign in,
 * own a wall and receive stickies like anyone else — but they keep their own
 * directory here, apart from the learner roster. Tap one to open their wall.
 */
export function Mentors() {
  const toast = useToast();
  const [mentors, setMentors] = useState<Mentor[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;
    getMentors()
      .then((m) => alive && setMentors(m))
      .catch(() => alive && toast("Couldn't load the mentors.", "error"));
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!mentors || !q) return mentors;
    return mentors.filter((m) =>
      [m.name, m.nickname, m.role, m.tagline, ...m.skills]
        .filter(Boolean)
        .some((f) => f!.toLowerCase().includes(q)),
    );
  }, [mentors, query]);

  return (
    <main class="page">
      <p class="page__lede">
        The seniors who mentor this cohort. Tap anyone to read their profile and leave them a sticky note.
      </p>

      {mentors && mentors.length > 0 && (
        <input
          type="search"
          class="field"
          placeholder="Search mentors, roles or skills…"
          value={query}
          aria-label="Search mentors"
          onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
        />
      )}

      {!mentors ? (
        <div class="center-screen">
          <Spinner />
        </div>
      ) : filtered?.length === 0 ? (
        <div class="empty">
          <div class="empty__emoji">🔍</div>
          <div class="empty__title">No mentors found</div>
          <p>Nothing matched “{query}”.</p>
        </div>
      ) : (
        <div class="mentors">
          {filtered?.map((m, i) => (
            <button
              key={m.id}
              class="mentor-card"
              onClick={() => navigate(`/m/${m.id}`)}
              aria-label={`Read ${m.name}'s profile`}
            >
              <Avatar name={m.name} url={m.thumbUrl} size="lg" eager={i < 6} />
              <div class="mentor-card__text">
                <div class="mentor-card__name">{m.name}</div>
                {m.role && <div class="mentor-card__role">{m.role}</div>}
                {m.tagline && (
                  <p class="mentor-card__tagline">{stripTags(m.tagline)}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

    </main>
  );
}
