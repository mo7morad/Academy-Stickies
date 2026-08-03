import { useEffect, useRef, useState } from "preact/hooks";
import { STICKY_COLORS, type StickyColor } from "../../shared/types";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";

export type SpotlightPerson = {
  id: string;
  name: string;
  thumbUrl: string | null;
  avatarUrl: string | null;
};

/** Skip gray so the strip stays lively; cycle the rest by index. */
const PAPER: StickyColor[] = STICKY_COLORS.filter((c) => c !== "gray");

const ROTATIONS = [-2.2, 1.6, -1.1, 2.0, -1.7];

/**
 * Horizontal strip of today's featured people as mini sticky notes.
 * One Write control per note opens Sticky / Letter chooser.
 */
export function DailySpotlight({
  title,
  people,
  onGive,
  onWriteLetter,
}: {
  title: string;
  people: SpotlightPerson[];
  onGive: (recipientId: string) => void;
  onWriteLetter: (recipientId: string) => void;
}) {
  const [choosingId, setChoosingId] = useState<string | null>(null);
  const rowRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!choosingId) return;
    function onPointerDown(e: PointerEvent) {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) {
        setChoosingId(null);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setChoosingId(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [choosingId]);

  if (people.length === 0) return null;

  return (
    <section class="daily-spotlight" aria-label={title}>
      <div class="daily-spotlight__header">
        <h2 class="daily-spotlight__title">{title}</h2>
        <p class="daily-spotlight__lede">
          Leave someone a sticky or a letter today.
        </p>
      </div>
      <ul class="daily-spotlight__row" ref={rowRef}>
        {people.map((p, i) => {
          const color = PAPER[i % PAPER.length];
          const open = choosingId === p.id;
          return (
            <li
              key={p.id}
              class={`daily-spotlight__card sticky--${color}${open ? " daily-spotlight__card--open" : ""}`}
              style={`--_rot:${ROTATIONS[i % ROTATIONS.length]}deg`}
            >
              <span class="daily-spotlight__tape" aria-hidden="true" />
              <Avatar
                name={p.name}
                url={p.thumbUrl}
                fullUrl={p.avatarUrl}
                size="md"
                eager={i < 5}
                zoomable={false}
              />
              <div class="daily-spotlight__name">{p.name}</div>
              {open ? (
                <div class="daily-spotlight__chooser" role="group" aria-label={`Write to ${p.name}`}>
                  <button
                    type="button"
                    class="daily-spotlight__choice"
                    onClick={() => {
                      setChoosingId(null);
                      onGive(p.id);
                    }}
                  >
                    <Icon name="note" size={14} />
                    Sticky
                  </button>
                  <button
                    type="button"
                    class="daily-spotlight__choice"
                    onClick={() => {
                      setChoosingId(null);
                      onWriteLetter(p.id);
                    }}
                  >
                    Letter
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  class="daily-spotlight__write"
                  aria-expanded={false}
                  aria-haspopup="true"
                  onClick={() => setChoosingId(p.id)}
                >
                  <Icon name="pencil" size={14} />
                  Write
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
