import { useEffect, useMemo, useState } from "preact/hooks";
import type { RosterMember } from "../../shared/types";
import { getMembers } from "../api";
import { Avatar } from "../components/Avatar";
import { Segmented, Spinner } from "../components/controls";
import { Icon } from "../components/Icon";
import { Pagination } from "../components/Pagination";
import { navigate } from "../router";
import { useToast } from "../toast";

type SessionFilter = "all" | "AM" | "PM";

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
  const PAGE_SIZE = 24;

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

  const visibleMembers = useMemo(() => {
    if (!filtered) return null;
    return filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [filtered, page]);

  const totalPages = filtered ? Math.ceil(filtered.length / PAGE_SIZE) : 0;

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
          <div class="roster-count">
            {filtered?.length} {filtered?.length === 1 ? "person" : "people"}
          </div>
          <div class="roster">
            {visibleMembers?.map((m, i) => (
              <button
                key={m.id}
                class={`member-card ${m.isSelf ? "member-card--self" : ""}`}
                onClick={() => navigate(m.isSelf ? "/me" : `/m/${m.id}`)}
                title={m.tagline ?? undefined}
              >
                <Avatar name={m.name} url={m.thumbUrl} size="lg" eager={i < 8} />
                <div class="member-card__name">{m.isSelf ? "You" : m.name}</div>
                <div class="member-card__meta">
                  {m.isSelf && <span class="badge-you">Your wall</span>}
                  {!m.isSelf && m.wallPublic && <Icon name="globe" size={12} />}
                  <span>
                    {m.receivedCount} note{m.receivedCount === 1 ? "" : "s"}
                  </span>
                </div>
                {m.session && <span class="member-card__session">{m.session}</span>}
              </button>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} setPage={setPage} />
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
