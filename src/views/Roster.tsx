import { useEffect, useState } from "preact/hooks";
import type { RosterMember } from "../../shared/types";
import { getMembers } from "../api";
import { Avatar } from "../components/Avatar";
import { Spinner } from "../components/controls";
import { Icon } from "../components/Icon";
import { navigate } from "../router";
import { useToast } from "../toast";

export function Roster({
  refreshSignal,
  onGive,
}: {
  refreshSignal: number;
  onGive: (recipientId?: string) => void;
}) {
  const toast = useToast();
  const [members, setMembers] = useState<RosterMember[] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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

  function openMember(m: RosterMember) {
    navigate(m.isSelf ? "/me" : `/m/${m.id}`);
  }

  const filteredMembers = members?.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main class="page">
      <p style="color:var(--label-secondary);margin:var(--sp-1) var(--sp-1) var(--sp-2);">
        Tap someone to see their wall, or use{" "}
        <strong style="color:var(--label);">New Sticky</strong> to leave a note.
      </p>

      <div style="margin-bottom: var(--s4);">
        <input
          type="search"
          class="field"
          placeholder="Search members..."
          value={searchQuery}
          onInput={(e) => setSearchQuery((e.currentTarget as HTMLInputElement).value)}
        />
      </div>

      {!members ? (
        <div class="center-screen">
          <Spinner />
        </div>
      ) : filteredMembers?.length === 0 ? (
        <div class="empty">
          <div class="empty__emoji">🔍</div>
          <div class="empty__title">No members found</div>
          <p>We couldn't find anyone matching "{searchQuery}".</p>
        </div>
      ) : (
        <div class="roster">
          {filteredMembers?.map((m) => (
            <button key={m.id} class={`member-card ${m.isSelf ? "member-card--self" : ""}`} onClick={() => openMember(m)}>
              <Avatar name={m.name} url={m.avatarUrl} size="lg" />
              <div class="member-card__name">{m.isSelf ? "You" : m.name}</div>
              <div class="member-card__meta">
                {m.isSelf ? (
                  <>
                    <span class="badge-you">Your wall</span>
                    <span style="opacity:0.6;margin-left:2px">&bull; {m.receivedCount} note{m.receivedCount === 1 ? "" : "s"}</span>
                  </>
                ) : (
                  <>
                    {m.wallPublic && <Icon name="globe" size={12} />}
                    {m.receivedCount} note{m.receivedCount === 1 ? "" : "s"}
                  </>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <div style="margin-top:var(--sp-6);text-align:center;">
        <button class="btn btn--tinted" onClick={() => onGive()}>
          <Icon name="plus" size={18} />
          Give a sticky
        </button>
      </div>
    </main>
  );
}
