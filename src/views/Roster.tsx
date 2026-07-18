import { useEffect, useMemo, useState } from "preact/hooks";
import { stripTags } from "../../shared/text";
import type { RosterMember } from "../../shared/types";
import { getMembers } from "../api";
import { Avatar } from "../components/Avatar";
import { Segmented, Spinner } from "../components/controls";
import { Icon } from "../components/Icon";
import { useToast } from "../toast";

type SessionFilter = "all" | "AM" | "PM";

/**
 * Rendered above and below the grid — 48 rows is far enough to scroll that
 * paging from the bottom shouldn't mean scrolling back up. The range count in
 * .roster-bar is the one live region, so neither copy announces.
 */
function Pager({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav class="pagination" aria-label="Roster pages">
      <button
        class="btn btn--tinted"
        disabled={page === 1}
        onClick={() => onPage(Math.max(1, page - 1))}
      >
        &larr; Prev
      </button>
      <span class="pagination__status">
        Page {page} of {totalPages}
      </span>
      <button
        class="btn btn--tinted"
        disabled={page === totalPages}
        onClick={() => onPage(Math.min(totalPages, page + 1))}
      >
        Next &rarr;
      </button>
    </nav>
  );
}

export function Roster({
  refreshSignal,
  onGive,
}: {
  refreshSignal: number;
  onGive: (recipientId?: string) => void;
}) {
  const toast = useToast();
  const [members, setMembers] = useState<RosterMember[] | null>(null);
  const [query, setQuery] = useState("");
  const [session, setSession] = useState<SessionFilter>("all");
  const [page, setPage] = useState(1);
  // Rows are far denser than the old photo cards, so a page holds more of the
  // cohort without becoming a wall of faces.
  const PAGE_SIZE = 48;

  useEffect(() => {
    let alive = true;
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

  useEffect(() => {
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
            <Pager page={page} totalPages={totalPages} onPage={setPage} />
          </div>
          <div class="roster">
            {visibleMembers?.map((m, i) => {
              // A "0" on all 209 cards is noise — the count earns its place
              // once there is one. The globe stands alone on an empty public
              // wall, since it says something the count cannot.
              const showsGlobe = m.wallPublic && !m.isSelf;
              const showsNotes = m.receivedCount > 0;
              return (
                <a
                  key={m.id}
                  class={`member-row ${m.isSelf ? "member-row--self" : ""}`}
                  href={m.isSelf ? "#/me" : `#/m/${m.id}`}
                >
                  <Avatar name={m.name} url={m.thumbUrl} size="md" eager={i < 12} />
                  <div class="member-row__text">
                    <div class="member-row__name">{m.isSelf ? "You" : m.name}</div>
                    <div class="member-row__sub">
                      {m.tagline ? (
                        <span class="member-row__tagline">
                          {stripTags(m.tagline)}
                        </span>
                      ) : (
                        <span class="member-row__tagline member-row__tagline--none">
                          No tagline yet
                        </span>
                      )}
                      {/* The icons are decorative, so this carries its own
                          label for screen readers. */}
                      {(showsNotes || showsGlobe) && (
                        <span
                          class="member-row__notes"
                          aria-label={[
                            showsGlobe && "Wall visible to the academy",
                            showsNotes &&
                              `${m.receivedCount} note${m.receivedCount === 1 ? "" : "s"}`,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        >
                          {showsGlobe && <Icon name="globe" size={11} />}
                          {showsNotes && (
                            <>
                              <Icon name="note" size={11} />
                              {m.receivedCount}
                            </>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                  {m.isSelf ? (
                    <span class="badge-you">You</span>
                  ) : (
                    m.session && (
                      <span class="member-row__session">{m.session}</span>
                    )
                  )}
                </a>
              );
            })}
          </div>
          <Pager page={page} totalPages={totalPages} onPage={setPage} />
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
