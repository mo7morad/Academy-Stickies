import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Me, WallResponse } from "../../shared/types";
import { deleteSticky, getWall, setWallPublic, uploadAvatar } from "../api";
import { Avatar } from "../components/Avatar";
import { HeaderActions } from "../components/HeaderActions";
import { Icon } from "../components/Icon";
import { Nav } from "../components/Nav";
import { ProfileBody } from "../components/ProfileBody";
import { Sheet } from "../components/Sheet";
import { StickyNote } from "../components/StickyNote";
import { Spinner, Switch } from "../components/controls";
import { squareCrop } from "../lib/image";
import { navigate } from "../router";
import { useToast } from "../toast";

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
  const [query, setQuery] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isSelf = memberId === me.id;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!wall) return [];
    if (!q) return wall.stickies;
    return wall.stickies.filter((s) =>
      [s.describedAs, s.goodAt, s.authorName].some((f) =>
        f?.toLowerCase().includes(q),
      ),
    );
  }, [wall, query]);

  async function load() {
    try {
      setWall(await getWall(memberId));
    } catch {
      toast("Couldn't load this wall.", "error");
    }
  }

  useEffect(() => {
    setWall(null);
    setQuery("");
    setShowProfile(false);
    load();
  }, [memberId, refreshSignal]);

  async function togglePublic(next: boolean) {
    try {
      const updated = await setWallPublic(next);
      onMeChange(updated);
      setWall((w) =>
        w ? { ...w, member: { ...w.member, wallPublic: next } } : w,
      );
      toast(
        next
          ? "Your wall is now visible to the academy."
          : "Your wall is private again.",
      );
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
      setWall((w) => (w ? { ...w, member: { ...w.member, avatarUrl } } : w));
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
  const profile = wall?.profile ?? null;

  return (
    <>
      <Nav
        title={title}
        subtitle={
          wall && wall.visible ? `${count} note${count === 1 ? "" : "s"}` : undefined
        }
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
            <header class={`wall-head ${isSelf ? "wall-head--self" : ""}`}>
              <div class="wall-head__avatar">
                <Avatar
                  name={wall.member.name}
                  url={wall.member.avatarUrl}
                  size={isSelf ? "xxl" : "xl"}
                  eager
                />
                {isSelf && (
                  <>
                    <button
                      class="icon-btn wall-head__camera"
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
                  </>
                )}
              </div>

              <div class="wall-head__text">
                <h1 class="wall-head__name">{wall.member.name}</h1>
                <div class="wall-head__meta">
                  {profile?.session && (
                    <span class="chip chip--session">{profile.session} session</span>
                  )}
                  {isSelf && <span class="chip">{me.email}</span>}
                </div>
                {profile?.tagline && (
                  <p class="wall-head__tagline">{profile.tagline}</p>
                )}

                <div class="wall-head__actions">
                  {profile && (
                    <button
                      class="btn btn--tinted"
                      onClick={() => setShowProfile(true)}
                    >
                      <Icon name="person" size={16} />
                      {isSelf ? "Your profile" : "Read profile"}
                    </button>
                  )}
                  {!isSelf && (
                    <button
                      class="btn btn--filled"
                      onClick={() => onGive(wall.member.id)}
                    >
                      <Icon name="plus" size={16} />
                      Give a sticky
                    </button>
                  )}
                </div>
              </div>
            </header>

            {isSelf && (
              <div class="group">
                <div class="row">
                  <div class="row__label">
                    Visible to the academy
                    <small>Let everyone see the notes on your wall.</small>
                  </div>
                  <Switch
                    checked={wall.member.wallPublic}
                    onChange={togglePublic}
                    label="Make my wall visible to the academy"
                  />
                </div>
              </div>
            )}

            {!wall.visible ? (
              <div class="empty">
                <div class="empty__emoji">🔒</div>
                <div class="empty__title">This wall is private</div>
                <p>
                  {wall.member.name} hasn't shared their wall yet — but you can
                  still read their profile and leave them a note.
                </p>
                <button
                  class="btn btn--filled empty__action"
                  onClick={() => onGive(wall.member.id)}
                >
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
                    : `Be the first to leave ${wall.member.name.split(" ")[0]} a note.`}
                </p>
              </div>
            ) : (
              <>
                {count > 3 && (
                  <input
                    type="search"
                    class="field"
                    placeholder="Search these stickies…"
                    value={query}
                    aria-label="Search stickies"
                    onInput={(e) =>
                      setQuery((e.currentTarget as HTMLInputElement).value)
                    }
                  />
                )}
                {filtered.length === 0 ? (
                  <div class="empty">
                    <div class="empty__emoji">🔍</div>
                    <div class="empty__title">No stickies found</div>
                    <p>Nothing matched “{query}”.</p>
                  </div>
                ) : (
                  <div class="wall">
                    {filtered.map((s) => (
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
          </>
        )}
      </main>

      {showProfile && profile && wall && (
        <Sheet
          title={isSelf ? "Your profile" : wall.member.name}
          onClose={() => setShowProfile(false)}
        >
          <div class="profile-head">
            <Avatar name={wall.member.name} url={wall.member.avatarUrl} size="xl" eager />
            <div>
              <div class="profile-head__name">{wall.member.name}</div>
              {profile.session && (
                <div class="profile-head__role">{profile.session} session</div>
              )}
            </div>
          </div>
          <ProfileBody
            intro={profile.intro}
            sections={profile.sections}
            links={profile.links}
          />
        </Sheet>
      )}
    </>
  );
}
