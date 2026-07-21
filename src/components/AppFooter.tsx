import { useEffect, useState } from "preact/hooks";
import type { RosterMember } from "../../shared/types";
import { getMembers } from "../api";

/** The three of us, keyed by the full name the cohort roster carries. Member
 *  ids are random UUIDs minted at seed time, so they differ between local and
 *  production — resolving by name is what keeps these links alive in both. */
const CREDITS = [
  { label: "John", fullName: "Muhammadjonov Javohir" },
  { label: "Ken", fullName: "Kenneth Muyoyo Omondi" },
  { label: "Morad", fullName: "Mohamed Essam Ahmed Morad Mohamed Morad" },
];

/** The credits can't change mid-session, so the footer reads the roster once
 *  and every route reuses it. Cleared on failure so a later mount can retry. */
let rosterOnce: Promise<RosterMember[]> | null = null;

function useRoster(): RosterMember[] | null {
  const [members, setMembers] = useState<RosterMember[] | null>(null);

  useEffect(() => {
    let alive = true;
    const pending = (rosterOnce ??= getMembers());
    pending
      .then((m) => alive && setMembers(m))
      .catch(() => {
        if (rosterOnce === pending) rosterOnce = null;
      });
    return () => {
      alive = false;
    };
  }, []);

  return members;
}

/** Exact first, then every-name-part. A roster entry that carries extra given
 *  names ("Mohamed Essam Ahmed Morad Mohamed Morad") still resolves from the
 *  shorter form above — dropping a name part used to silently flatten a credit
 *  into plain text. Ambiguous matches resolve to nothing rather than the wrong
 *  person's wall. */
function findMember(
  members: RosterMember[],
  fullName: string,
): RosterMember | null {
  const parts = fullName.toLowerCase().split(/\s+/).filter(Boolean);
  const exact = members.find((m) => m.name.toLowerCase() === parts.join(" "));
  if (exact) return exact;

  const loose = members.filter((m) => {
    const name = m.name.toLowerCase().split(/\s+/);
    return parts.every((p) => name.includes(p));
  });
  return loose.length === 1 ? loose[0] : null;
}

export function AppFooter() {
  const members = useRoster();

  const hrefFor = (fullName: string): string | null => {
    const hit = members && findMember(members, fullName);
    if (!hit) return null;
    return hit.isSelf ? "#/me" : `#/m/${hit.id}`;
  };

  return (
    <footer class="app-footer">
      <p class="app-footer__made">
        Made with <span class="app-footer__heart">♥</span> by{" "}
        {CREDITS.map(({ label, fullName }, i) => {
          const href = hrefFor(fullName);
          return (
            <>
              {i > 0 && (i === CREDITS.length - 1 ? ", and " : ", ")}
              {/* Until the roster resolves — or if one of us isn't in it —
                  the name stays plain text rather than a dead link. */}
              {href ? (
                <a class="app-footer__person" href={href} title={fullName}>
                  {label}
                </a>
              ) : (
                <span class="app-footer__person app-footer__person--flat">
                  {label}
                </span>
              )}
            </>
          );
        })}
      </p>
      <p class="app-footer__tag">
        Academy Stickies · say something nice about someone today
      </p>
    </footer>
  );
}
