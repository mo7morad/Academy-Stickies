import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { stripTags } from "../../shared/text";
import type { Me, RosterMember } from "../../shared/types";
import { MAX_FIELD_LEN, STICKY_COLORS } from "../../shared/types";
import { createSticky, getMembers, getMentors } from "../api";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import { Segmented, Spinner } from "../components/controls";
import { fitPhoto } from "../lib/image";
import { useToast } from "../toast";

export function GiveSticky({
  me,
  prefillRecipientId,
  onCreated,
}: {
  me: Me;
  prefillRecipientId?: string;
  onCreated: (recipientId: string) => void;
}) {
  const toast = useToast();
  const [members, setMembers] = useState<RosterMember[] | null>(null);
  const [query, setQuery] = useState("");
  const [recipientId, setRecipientId] = useState(prefillRecipientId ?? "");
  const [describedAs, setDescribedAs] = useState("");
  const [goodAt, setGoodAt] = useState("");
  const [color, setColor] = useState<string>("yellow");
  const [anon, setAnon] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  /** The 200-face strip is a chooser, not a fixture: it is only on screen while
   *  there is still a choice to make. Arriving from someone's wall, the choice
   *  is already made and the note is what the writer came for. */
  const [picking, setPicking] = useState(!prefillRecipientId);

  useEffect(() => {
    Promise.all([getMembers(), getMentors()])
      .then(([m, mt]) => {
        const mentorsAsMembers: RosterMember[] = mt.map((mentor) => ({
          id: mentor.id,
          name: mentor.name,
          avatarUrl: mentor.photoUrl,
          thumbUrl: mentor.thumbUrl,
          wallPublic: true,
          isSelf: mentor.id === me.id,
          receivedCount: 0,
          session: mentor.role,
          tagline: mentor.tagline,
        }));
        // You can't give yourself a sticky — and a signed-in mentor now shows up
        // in the mentor list, so filter by id, not just the roster's isSelf flag.
        setMembers(
          [...m, ...mentorsAsMembers].filter((x) => x.id !== me.id),
        );
      })
      .catch(() => toast("Couldn't load members.", "error"));
  }, []);

  const photoUrl = useMemo(
    () => (photo ? URL.createObjectURL(photo) : null),
    [photo],
  );
  useEffect(
    () => () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    },
    [photoUrl],
  );

  const recipient = members?.find((m) => m.id === recipientId) ?? null;

  // The chosen person stays pinned to the front so they never scroll out of
  // view behind a search that no longer matches them.
  const shown = useMemo(() => {
    if (!members) return null;
    const q = query.trim().toLowerCase();
    const matches = q
      ? members.filter(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            (m.tagline?.toLowerCase().includes(q) ?? false),
        )
      : members;
    if (recipient && !matches.some((m) => m.id === recipient.id)) {
      return [recipient, ...matches];
    }
    return matches;
  }, [members, query, recipient]);

  const canSubmit =
    !!recipientId && (describedAs.trim().length > 0 || goodAt.trim().length > 0);

  function choose(id: string) {
    setRecipientId(id);
    setQuery("");
    setPicking(false);
  }

  function changeRecipient() {
    setPicking(true);
    // Reopening is a deliberate act — land the caret where the searching happens.
    requestAnimationFrame(() => searchRef.current?.focus());
  }

  async function submit() {
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      const photoBlob = photo ? await fitPhoto(photo) : null;
      await createSticky({
        recipientId,
        describedAs: describedAs.trim(),
        goodAt: goodAt.trim(),
        isAnonymous: anon,
        color,
        photo: photoBlob,
      });
      toast("Sticky delivered 🎉");
      onCreated(recipientId);
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Couldn't send that sticky.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="give">
      {!members ? (
        <div class="give__loading">
          <Spinner />
        </div>
      ) : recipient && !picking ? (
        // Who the note is for, said once and said plainly — a face and a full
        // name, not a highlighted thumbnail to pick back out of a crowd.
        <div class="give__chosen">
          <Avatar name={recipient.name} url={recipient.thumbUrl} size="lg" />
          <div class="give__chosen-text">
            <div class="give__chosen-eyebrow">Writing to</div>
            <div class="give__chosen-name">{recipient.name}</div>
            {(recipient.tagline || recipient.session) && (
              <div class="give__chosen-sub">
                {recipient.tagline
                  ? stripTags(recipient.tagline)
                  : recipient.session}
              </div>
            )}
          </div>
          <button class="btn btn--plain give__change" onClick={changeRecipient}>
            Change
          </button>
        </div>
      ) : (
        <>
          <div class="group__header">To</div>
          <input
            ref={searchRef}
            type="search"
            class="field"
            placeholder="Search for someone…"
            value={query}
            aria-label="Search for a recipient"
            onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
          />
          {shown?.length === 0 ? (
            <p class="give__none">Nobody matched “{query}”.</p>
          ) : (
            <div class="picker" role="listbox" aria-label="Recipient">
              {shown?.map((m) => {
                const selected = m.id === recipientId;
                return (
                  <button
                    key={m.id}
                    role="option"
                    aria-selected={selected}
                    class={`picker__item ${selected ? "picker__item--on" : ""}`}
                    onClick={() => choose(m.id)}
                  >
                    <Avatar name={m.name} url={m.thumbUrl} size="md" />
                    <span class="picker__name">{m.name.split(" ")[0]}</span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      <div class="group__header">The note</div>
      <div class="group">
        <FieldArea
          label="I'd describe you as…"
          value={describedAs}
          onInput={setDescribedAs}
        />
        <FieldArea
          label="You're great at… (professionally)"
          value={goodAt}
          onInput={setGoodAt}
        />
      </div>

      <div class="group__header">Paper color</div>
      <div class="group">
        <div class="swatches">
          {STICKY_COLORS.map((c) => (
            <button
              key={c}
              class="swatch"
              aria-selected={color === c}
              aria-label={c}
              onClick={() => setColor(c)}
              style={`--_top:var(--sticky-${c}-top);--_bot:var(--sticky-${c}-bot);`}
            />
          ))}
        </div>
      </div>

      <div class="group__header">Signature</div>
      <Segmented
        value={anon ? "anon" : "signed"}
        onChange={(v) => setAnon(v === "anon")}
        options={[
          { value: "signed", label: `Sign it · ${me.name.split(" ")[0]}` },
          { value: "anon", label: "Anonymous" },
        ]}
      />
      <p class="give__hint">
        {anon
          ? "Your name is never stored on anonymous stickies."
          : "They'll see your name on this sticky."}
      </p>

      <div class="group">
        {photoUrl ? (
          <div class="row">
            <img src={photoUrl} alt="" class="give__thumb" />
            <div class="row__label">Photo attached</div>
            <button
              class="btn btn--plain btn--danger"
              onClick={() => setPhoto(null)}
            >
              Remove
            </button>
          </div>
        ) : (
          <button class="row give__add-photo" onClick={() => fileRef.current?.click()}>
            <Icon name="camera" size={20} />
            <div class="row__label">Add a photo (optional)</div>
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(e) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            if (f) setPhoto(f);
          }}
        />
      </div>

      <button
        class="btn btn--filled btn--full btn--lg"
        disabled={!canSubmit || busy}
        onClick={submit}
      >
        {busy ? (
          <Spinner />
        ) : (
          <>
            <Icon name="paperplane" size={18} /> Send sticky
          </>
        )}
      </button>
    </div>
  );
}

function FieldArea({
  label,
  value,
  onInput,
}: {
  label: string;
  value: string;
  onInput: (v: string) => void;
}) {
  return (
    <div class="field-wrap">
      <textarea
        class="field field--multiline"
        placeholder={label}
        maxLength={MAX_FIELD_LEN}
        value={value}
        aria-label={label}
        onInput={(e) => onInput((e.target as HTMLTextAreaElement).value)}
      />
      <div class={`field-count ${value ? "field-count--on" : ""}`}>
        {value.length}/{MAX_FIELD_LEN}
      </div>
    </div>
  );
}
