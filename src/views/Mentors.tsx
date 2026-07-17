import { useEffect, useMemo, useState } from "preact/hooks";
import type { Mentor } from "../../shared/types";
import { getMentors } from "../api";
import { Avatar } from "../components/Avatar";
import { ProfileBody } from "../components/ProfileBody";
import { Sheet } from "../components/Sheet";
import { Spinner } from "../components/controls";
import { useToast } from "../toast";

/**
 * The mentor directory. Mentors ("seniors") guide the cohort but are not roster
 * members: they have no wall and receive no stickies, so this view is read-only.
 */
export function Mentors() {
  const toast = useToast();
  const [mentors, setMentors] = useState<Mentor[] | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Mentor | null>(null);

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
        The seniors who mentor this cohort. Tap anyone to read their profile —
        what they teach, and the best way to reach them.
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
              onClick={() => setOpen(m)}
              aria-label={`Read ${m.name}'s profile`}
            >
              <Avatar name={m.name} url={m.thumbUrl} size="lg" eager={i < 6} />
              <div class="mentor-card__text">
                <div class="mentor-card__name">{m.name}</div>
                {m.role && <div class="mentor-card__role">{m.role}</div>}
                {m.tagline && <p class="mentor-card__tagline">{m.tagline}</p>}
              </div>
            </button>
          ))}
        </div>
      )}

      {open && (
        <Sheet title={open.name} onClose={() => setOpen(null)}>
          <div class="profile-head">
            <Avatar name={open.name} url={open.photoUrl} size="xl" eager />
            <div>
              <div class="profile-head__name">{open.name}</div>
              {open.role && <div class="profile-head__role">{open.role}</div>}
              {open.nickname && (
                <div class="profile-head__meta">Goes by {open.nickname}</div>
              )}
            </div>
          </div>
          <ProfileBody
            intro={open.intro}
            sections={open.sections}
            links={open.links}
            skills={open.skills}
          />
        </Sheet>
      )}
    </main>
  );
}
