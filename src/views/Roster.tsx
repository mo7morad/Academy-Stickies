import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { stripTags } from "../../shared/text";
import type { RosterMember } from "../../shared/types";
import { getMembers, invalidateMembers } from "../api";
import { Avatar } from "../components/Avatar";
import { Segmented, Spinner } from "../components/controls";
import { Icon } from "../components/Icon";
import { Pager } from "../components/Pager";
import { useToast } from "../toast";

type SessionFilter = "all" | "AM" | "PM";

/**
 * Roster browsing state, held at module scope so returning from a profile lands
 * back where you were — same page, same filters, same scroll — instead of
 * snapping to the top of page one. It resets on a full reload; this only has to
 * bridge in-app navigation, where the component unmounts and remounts.
 */
const view: {
  page: number;
  query: string;
  session: SessionFilter;
  scrollY: number;
} = { page: 1, query: "", session: "all", scrollY: 0 };

export function Roster({
  refreshSignal,
  onGive,
}: {
  refreshSignal: number;
  onGive: (recipientId?: string) => void;
}) {
  const toast = useToast();
  const [members, setMembers] = useState<RosterMember[] | null>(null);
  const [query, setQuery] = useState(view.query);
  const [session, setSession] = useState<SessionFilter>(view.session);
  const [page, setPage] = useState(view.page);
  const PAGE_SIZE = 24;

  // Mirror the browsing state so the next mount can restore it, and stash the
  // scroll position on the way out.
  useEffect(() => {
    view.page = page;
    view.query = query;
    view.session = session;
  }, [page, query, session]);

  useEffect(() => {
    return () => {
      view.scrollY = window.scrollY;
    };
  }, []);

  // Restore scroll once the grid has actually painted, and only the first time.
  const restored = useRef(false);
  useEffect(() => {
    if (members && !restored.current) {
      restored.current = true;
      if (view.scrollY > 0) window.scrollTo(0, view.scrollY);
    }
  }, [members]);

  useEffect(() => {
    let alive = true;
    // A new sticky changes the counts on these cards, so a refresh has to go
    // past the shared cache. The first load reuses it.
    if (refreshSignal > 0) invalidateMembers();
    getMembers()
      .then((m) => {
        if (!alive) return;
        setMembers([...m].sort((a, b) => (a.isSelf ? -1 : b.isSelf ? 1 : 0)));
      })
      .catch(() => alive && toast("Couldn't load the roster.", "error"));
    return () => {
      alive = false;
    };
  }, [refreshSignal]);

  const filtered = useMemo(() => {
    if (!members) return null;
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      if (session !== "all" && m.session !== session) return false;
      if (!q) return true;
      // Taglines come from each member's own profile, so this searches both
      // who someone is and what they're about.
      return (
        m.name.toLowerCase().includes(q) ||
        (m.tagline?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [members, query, session]);

  const hasSessions = useMemo(
    () => members?.some((m) => m.session) ?? false,
    [members],
  );

  // A real filter change starts over on page one, but the restored page must
  // survive the first render — otherwise coming back always lands on page one.
  const firstFilter = useRef(true);
  useEffect(() => {
    if (firstFilter.current) {
      firstFilter.current = false;
      return;
    }
    setPage(1);
  }, [query, session]);

  const totalPages = filtered ? Math.ceil(filtered.length / PAGE_SIZE) : 0;

  const visibleMembers = useMemo(() => {
    if (!filtered) return null;
    return filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [filtered, page]);

  const rangeStart = (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, filtered?.length ?? 0);

  return (
    <main class="page">
      <p class="page__lede">
        Tap someone to read their profile and see their wall, or use{" "}
        <strong>New Sticky</strong> to leave a note.
      </p>

      <div class="filters">
        <input
          type="search"
          class="field"
          placeholder="Search by name or what they're into…"
          value={query}
          aria-label="Search learners"
          onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
        />
        {hasSessions && (
          <Segmented<SessionFilter>
            value={session}
            onChange={setSession}
            options={[
              { value: "all", label: "Everyone" },
              { value: "AM", label: "AM" },
              { value: "PM", label: "PM" },
            ]}
          />
        )}
      </div>

      {!members ? (
        <div class="center-screen">
          <Spinner />
        </div>
      ) : filtered?.length === 0 ? (
        <div class="empty">
          <div class="empty__emoji">🔍</div>
          <div class="empty__title">Nobody here</div>
          <p>
            {query
              ? `Nothing matched “${query}”.`
              : "No one in this session yet."}
          </p>
        </div>
      ) : (
        <>
          <div class="roster-bar">
            <div class="roster-count" aria-live="polite">
              {rangeStart}–{rangeEnd} of {filtered?.length}{" "}
              {filtered?.length === 1 ? "person" : "people"}
            </div>
            <Pager
              page={page}
              totalPages={totalPages}
              label="Roster pages"
              onPage={setPage}
            />
          </div>
          <div class="roster">
            {visibleMembers?.map((m, i) => {
              // A "0" on every card is noise — the count earns its place once
              // there's one. The globe stands alone on an empty public wall,
              // since it says something the count cannot.
              const showsGlobe = m.wallPublic && !m.isSelf;
              const showsNotes = m.receivedCount > 0;
              return (
                <a
                  key={m.id}
                  class={`member-card ${m.isSelf ? "member-card--self" : ""}`}
                  href={m.isSelf ? "#/me" : `#/m/${m.id}`}
                  title={m.tagline ? stripTags(m.tagline) : undefined}
                >
                  <Avatar name={m.name} url={m.thumbUrl} size="lg" eager={i < 8} />
                  <div class="member-card__name">{m.isSelf ? "You" : m.name}</div>
                  {(m.isSelf || showsGlobe || showsNotes) && (
                    <div class="member-card__meta">
                      {m.isSelf && <span class="badge-you">Your wall</span>}
                      {showsGlobe && <Icon name="globe" size={12} />}
                      {showsNotes && (
                        <span>
                          {m.receivedCount} note{m.receivedCount === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                  )}
                  {m.session && (
                    <span class="member-card__session">{m.session}</span>
                  )}
                </a>
              );
            })}
          </div>
          <Pager
            page={page}
            totalPages={totalPages}
            label="Roster pages"
            onPage={setPage}
          />
        </>
      )}

      <div class="page__footer-action">
        <button class="btn btn--tinted" onClick={() => onGive()}>
          <Icon name="plus" size={18} />
          Give a sticky
        </button>
      </div>
    </main>
  );
}
