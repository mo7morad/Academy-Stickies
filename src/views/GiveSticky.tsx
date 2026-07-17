import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Me, RosterMember } from "../../shared/types";
import { MAX_FIELD_LEN, STICKY_COLORS } from "../../shared/types";
import { createSticky, getMembers } from "../api";
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

  useEffect(() => {
    getMembers()
      .then((m) => setMembers(m.filter((x) => !x.isSelf)))
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
      <div class="group__header">
        To {recipient && <span class="give__to">· {recipient.name}</span>}
      </div>

      {!members ? (
        <div class="give__loading">
          <Spinner />
        </div>
      ) : (
        <>
          <input
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
                    onClick={() => setRecipientId(m.id)}
                  >
                    <Avatar name={m.name} url={m.avatarUrl} size="md" />
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
      <div class="field-count">
        {value.length}/{MAX_FIELD_LEN}
      </div>
    </div>
  );
}
