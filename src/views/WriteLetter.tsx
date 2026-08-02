import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { stripTags } from "../../shared/text";
import type { Me, RosterMember } from "../../shared/types";
import {
  LETTER_STYLES,
  MAX_LETTER_BODY_LEN,
  MAX_LETTER_SUBJECT_LEN,
} from "../../shared/types";
import { createLetter, getMembers, getMentors } from "../api";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import { Segmented, Spinner } from "../components/controls";
import { fitPhoto } from "../lib/image";
import { useToast } from "../toast";

export function WriteLetter({
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
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [paperStyle, setPaperStyle] = useState<string>("classic");
  const [anon, setAnon] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
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
        setMembers(
          [...m, ...mentorsAsMembers].filter((x) => x.id !== me.id),
        );
      })
      .catch(() => toast("Couldn't load members.", "error"));
  }, []);

  useEffect(() => {
    if (!picking || !recipientId) return;
    function onPointerDown(e: PointerEvent) {
      if (
        searchRef.current &&
        !searchRef.current.contains(e.target as Node) &&
        pickerRef.current &&
        !pickerRef.current.contains(e.target as Node)
      ) {
        setPicking(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [picking, recipientId]);

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

  const canSubmit = !!recipientId && body.trim().length > 0;

  function choose(id: string) {
    setRecipientId(id);
    setQuery("");
    setPicking(false);
  }

  function changeRecipient() {
    setPicking(true);
    requestAnimationFrame(() => searchRef.current?.focus());
  }

  async function submit() {
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      const photoBlob = photo ? await fitPhoto(photo) : null;
      await createLetter({
        recipientId,
        subject: subject.trim(),
        body: body.trim(),
        paperStyle,
        isAnonymous: anon,
        photo: photoBlob,
      });
      toast("Letter sealed and delivered ✉️");
      onCreated(recipientId);
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Couldn't send that letter.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  const paperStyleLabels: Record<string, string> = {
    classic: "Cream",
    kraft: "Kraft",
    rose: "Rose",
    midnight: "Midnight",
    sage: "Sage",
  };

  return (
    <div class="give">
      {!members ? (
        <div class="give__loading">
          <Spinner />
        </div>
      ) : recipient && !picking ? (
        <div class="give__chosen">
          <Avatar name={recipient.name} url={recipient.thumbUrl} fullUrl={recipient.avatarUrl} size="lg" />
          <div class="give__chosen-text">
            <div class="give__chosen-eyebrow">Writing letter to</div>
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
            <div ref={pickerRef} class="picker" role="listbox" aria-label="Recipient">
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
                    <Avatar name={m.name} url={m.thumbUrl} fullUrl={m.avatarUrl} size="md" />
                    <span class="picker__name">{m.name.split(" ")[0]}</span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      <div class="group__header">Subject (optional)</div>
      <div class="group">
        <input
          type="text"
          class="field"
          placeholder="e.g. Words of encouragement, Thank you..."
          maxLength={MAX_LETTER_SUBJECT_LEN}
          value={subject}
          onInput={(e) => setSubject((e.currentTarget as HTMLInputElement).value)}
        />
      </div>

      <div class="group__header">Your Letter (Markdown supported)</div>
      <div class="group">
        <div class="field-wrap">
          <textarea
            class="field field--multiline letter-editor__textarea"
            placeholder="Write your personal letter here..."
            maxLength={MAX_LETTER_BODY_LEN}
            value={body}
            rows={7}
            aria-label="Letter body"
            onInput={(e) => setBody((e.target as HTMLTextAreaElement).value)}
          />
          <div class={`field-count ${body ? "field-count--on" : ""}`}>
            {body.length}/{MAX_LETTER_BODY_LEN}
          </div>
        </div>
      </div>

      <div class="group__header">Stationery & Envelope Theme</div>
      <div class="group">
        <div class="paper-swatches">
          {LETTER_STYLES.map((s) => (
            <button
              key={s}
              type="button"
              class={`paper-swatch paper-swatch--${s} ${
                paperStyle === s ? "paper-swatch--selected" : ""
              }`}
              aria-selected={paperStyle === s}
              onClick={() => setPaperStyle(s)}
            >
              <span class="paper-swatch__name">{paperStyleLabels[s] ?? s}</span>
            </button>
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
          ? "Your name is never stored on anonymous letters."
          : "They'll see your name when they unseal this letter."}
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
            <div class="row__label">Attach a photo (optional)</div>
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
            <Icon name="paperplane" size={18} /> Seal & Send Letter
          </>
        )}
      </button>
    </div>
  );
}
