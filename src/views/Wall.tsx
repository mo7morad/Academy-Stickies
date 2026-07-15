import { useEffect, useRef, useState } from "preact/hooks";
import type { Me, WallResponse } from "../../shared/types";
import { deleteSticky, getWall, setWallPublic, uploadAvatar } from "../api";
import { Avatar } from "../components/Avatar";
import { Spinner, Switch } from "../components/controls";
import { Icon } from "../components/Icon";
import { Nav } from "../components/Nav";
import { StickyNote } from "../components/StickyNote";
import { squareCrop } from "../lib/image";
import { navigate } from "../router";
import { useToast } from "../toast";
import { HeaderActions } from "../components/HeaderActions";

export function Wall({
  me,
  memberId,
  refreshSignal,
  onGive,
  onMeChange,
  onLogout,
  theme,
  onToggleTheme,
}: {
  me: Me;
  memberId: string;
  refreshSignal: number;
  onGive: (recipientId?: string) => void;
  onMeChange: (me: Me) => void;
  onLogout: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  const toast = useToast();
  const [wall, setWall] = useState<WallResponse | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isSelf = memberId === me.id;

  async function load() {
    try {
      setWall(await getWall(memberId));
    } catch {
      toast("Couldn't load this wall.", "error");
    }
  }

  useEffect(() => {
    setWall(null);
    load();
  }, [memberId, refreshSignal]);

  async function togglePublic(next: boolean) {
    try {
      const updated = await setWallPublic(next);
      onMeChange(updated);
      setWall((w) => (w ? { ...w, member: { ...w.member, wallPublic: next } } : w));
      toast(next ? "Your wall is now visible to the academy." : "Your wall is private again.");
    } catch {
      toast("Couldn't update your wall.", "error");
    }
  }

  async function onPickAvatar(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const cropped = await squareCrop(file);
      const { avatarUrl } = await uploadAvatar(cropped);
      onMeChange({ ...me, avatarUrl });
      toast("Photo updated.");
    } catch {
      toast("Couldn't upload that photo.", "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeSticky(id: string) {
    try {
      await deleteSticky(id);
      setWall((w) =>
        w ? { ...w, stickies: w.stickies.filter((s) => s.id !== id) } : w,
      );
      toast("Sticky removed.");
    } catch {
      toast("Couldn't remove that sticky.", "error");
    }
  }

  const title = isSelf ? "Your Wall" : (wall?.member.name ?? "Wall");
  const count = wall?.stickies.length ?? 0;

  return (
    <>
      <Nav
        title={title}
        subtitle={wall && wall.visible ? `${count} note${count === 1 ? "" : "s"}` : undefined}
        onBack={() => navigate("/")}
        right={
          <HeaderActions
            theme={theme}
            onToggleTheme={onToggleTheme}
            onLogout={isSelf ? onLogout : undefined}
          />
        }
      />
      <main class="page">
        {!wall ? (
          <div class="center-screen">
            <Spinner />
          </div>
        ) : (
          <>
            {isSelf && (
              <SelfHeader
                me={me}
                uploading={uploading}
                fileRef={fileRef}
                onPickAvatar={onPickAvatar}
                wallPublic={wall.member.wallPublic}
                onTogglePublic={togglePublic}
              />
            )}

            {!isSelf && (
              <div style="display:flex;align-items:center;gap:var(--sp-3);margin:var(--sp-2) 0 var(--sp-4);">
                <Avatar name={wall.member.name} url={wall.member.avatarUrl} size="lg" />
                <div style="flex:1;">
                  <div style="font-size:var(--text-title3);font-weight:700;">
                    {wall.member.name}
                  </div>
                  <button class="btn btn--tinted" style="margin-top:var(--sp-2);" onClick={() => onGive(wall.member.id)}>
                    <Icon name="plus" size={16} />
                    Give a sticky
                  </button>
                </div>
              </div>
            )}

            {!wall.visible ? (
              <div class="empty">
                <div class="empty__emoji">🔒</div>
                <div class="empty__title">This wall is private</div>
                <p>{wall.member.name} hasn't shared their wall with the academy yet.</p>
                <button class="btn btn--filled" style="margin-top:var(--sp-4);" onClick={() => onGive(wall.member.id)}>
                  Leave them a sticky anyway
                </button>
              </div>
            ) : count === 0 ? (
              <div class="empty">
                <div class="empty__emoji">🗒️</div>
                <div class="empty__title">
                  {isSelf ? "No stickies yet" : "An empty wall"}
                </div>
                <p>
                  {isSelf
                    ? "When academy members describe you, their notes land here."
                    : `Be the first to leave ${wall.member.name} a note.`}
                </p>
              </div>
            ) : (
              <div class="wall">
                {wall.stickies.map((s) => (
                  <StickyNote
                    key={s.id}
                    sticky={s}
                    canDelete={isSelf}
                    onDelete={removeSticky}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}

function SelfHeader({
  me,
  uploading,
  fileRef,
  onPickAvatar,
  wallPublic,
  onTogglePublic,
}: {
  me: Me;
  uploading: boolean;
  fileRef: { current: HTMLInputElement | null };
  onPickAvatar: (e: Event) => void;
  wallPublic: boolean;
  onTogglePublic: (v: boolean) => void;
}) {
  return (
    <>
      <div style="display:flex;flex-direction:column;align-items:center;text-align:center;margin:var(--sp-2) 0 var(--sp-5);">
        <div style="position:relative;">
          <Avatar name={me.name} url={me.avatarUrl} size="xl" />
          <button
            class="icon-btn"
            style="position:absolute;right:-4px;bottom:-4px;background:var(--tint);color:var(--tint-contrast);box-shadow:var(--shadow-card);"
            aria-label="Change photo"
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? <Spinner /> : <Icon name="camera" size={18} />}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={onPickAvatar}
          />
        </div>
        <div style="font-size:var(--text-title2);font-weight:700;margin-top:var(--sp-3);">
          {me.name}
        </div>
        <div style="color:var(--label-secondary);font-size:var(--text-subhead);">
          {me.email}
        </div>
      </div>

      <div class="group">
        <div class="row">
          <div class="row__label">
            Visible to the academy
            <small>Let everyone see the notes on your wall.</small>
          </div>
          <Switch
            checked={wallPublic}
            onChange={onTogglePublic}
            label="Make my wall visible to the academy"
          />
        </div>
      </div>
    </>
  );
}
