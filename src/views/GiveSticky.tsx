import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Me, RosterMember } from "../../shared/types";
import { MAX_FIELD_LEN, STICKY_COLORS } from "../../shared/types";
import { createSticky, getMembers } from "../api";
import { Avatar } from "../components/Avatar";
import { Segmented, Spinner } from "../components/controls";
import { Icon } from "../components/Icon";
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
  useEffect(() => () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

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
      toast(err instanceof Error ? err.message : "Couldn't send that sticky.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {/* Recipient */}
      <div class="group__header">To</div>
      {!members ? (
        <div style="padding:var(--sp-4);">
          <Spinner />
        </div>
      ) : (
        <div
          style="display:flex;gap:var(--sp-3);overflow-x:auto;padding:var(--sp-1) 2px var(--sp-4);"
        >
          {members.map((m) => {
            const selected = m.id === recipientId;
            return (
              <button
                key={m.id}
                onClick={() => setRecipientId(m.id)}
                aria-pressed={selected}
                style={`flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:6px;width:64px;opacity:${selected ? 1 : 0.6};transition:opacity .15s;`}
              >
                <div
                  style={`border-radius:50%;padding:2px;box-shadow:${selected ? "0 0 0 2px var(--tint)" : "0 0 0 2px transparent"};transition:box-shadow .15s;`}
                >
                  <Avatar name={m.name} url={m.avatarUrl} size="md" />
                </div>
                <span style="font-size:var(--text-caption);text-align:center;line-height:1.1;max-width:64px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                  {m.name.split(" ")[0]}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* The note */}
      <div class="group__header">The note</div>
      <div class="group" style="margin-bottom:var(--sp-4);">
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

      {/* Paper color */}
      <div class="group__header">Paper color</div>
      <div class="group" style="margin-bottom:var(--sp-4);">
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

      {/* Signature */}
      <div class="group__header">Signature</div>
      <div style="padding:2px var(--sp-1) var(--sp-1);">
        <Segmented
          value={anon ? "anon" : "signed"}
          onChange={(v) => setAnon(v === "anon")}
          options={[
            { value: "signed", label: `Sign it · ${me.name.split(" ")[0]}` },
            { value: "anon", label: "Anonymous" },
          ]}
        />
      </div>
      <p style="color:var(--label-tertiary);font-size:var(--text-footnote);padding:var(--sp-2) var(--sp-1) var(--sp-4);">
        {anon
          ? "Your name is never stored on anonymous stickies."
          : "They'll see your name on this sticky."}
      </p>

      {/* Photo */}
      <div class="group" style="margin-bottom:var(--sp-5);">
        {photoUrl ? (
          <div class="row">
            <img
              src={photoUrl}
              alt=""
              style="width:52px;height:52px;border-radius:var(--r-sm);object-fit:cover;"
            />
            <div class="row__label">Photo attached</div>
            <button class="btn btn--plain btn--danger" onClick={() => setPhoto(null)}>
              Remove
            </button>
          </div>
        ) : (
          <button
            class="row"
            style="width:100%;color:var(--tint);"
            onClick={() => fileRef.current?.click()}
          >
            <Icon name="camera" size={20} />
            <div class="row__label" style="text-align:left;">
              Add a photo (optional)
            </div>
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
        {busy ? <Spinner /> : <><Icon name="paperplane" size={18} /> Send sticky</>}
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
