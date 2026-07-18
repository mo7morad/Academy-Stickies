import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { stripTags } from "../../shared/text";
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
import { resolveProfileLinks } from "../lib/links";
import { navigate } from "../router";
import { useToast } from "../toast";

/**
 * Someone's profile and the stickies the cohort left them.
 *
 * Desktop reads as a page: one identity hero across the top, then the profile
 * and the wall side by side, so neither buries the other. Phones keep the wall
 * above the fold and move the profile into a sheet.
 */
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
  const links = profile ? resolveProfileLinks(profile) : [];

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
            <header
              class={`wall-hero ${isSelf ? "wall-hero--self" : ""} ${profile ? "wall-hero--with-about" : ""}`}
            >
              <div class="wall-hero__avatar">
                <Avatar
                  name={wall.member.name}
                  url={wall.member.avatarUrl}
                  size={isSelf ? "xxl" : "xl"}
                  eager
                />
                {isSelf && (
                  <>
                    <button
                      class="icon-btn wall-hero__camera"
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

              <div class="wall-hero__text">
                <h1 class="wall-hero__name">{wall.member.name}</h1>

                <div class="wall-hero__meta">
                  {profile?.session && (
                    <span class="chip chip--session">{profile.session} session</span>
                  )}
                  {isSelf && <span class="chip">{me.email}</span>}
                </div>

                {profile?.tagline && (
                  <p class="wall-hero__tagline">{stripTags(profile.tagline)}</p>
                )}

                {links.length > 0 && (
                  <div class="wall-hero__links">
                    {links.map((l) => (
                      <a
                        key={l.url}
                        class="chip chip--link"
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                      >
                        <Icon name={l.icon} size={13} />
                        {l.label}
                      </a>
                    ))}
                  </div>
                )}

                <div class="wall-hero__actions">
                  {profile && (
                    <button
                      class="btn btn--tinted hidden-on-desktop"
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

            {/* Nothing to set beside the profile means no second column — a
                private or empty wall would otherwise leave half the page void
                next to a long profile. */}
            <div
              class={`wall-body ${wall.visible && count > 0 ? "" : "wall-body--single"}`}
            >
              {profile && (
                <section class="wall-about hidden-on-mobile">
                  {/* "Profile", not "About" — most members title their own
                      first section "About Me", and the two stacked read as a
                      stutter. */}
                  <h2 class="wall-col__title">Profile</h2>
                  <ProfileBody
                    intro={profile.intro}
                    sections={profile.sections}
                    links={profile.links}
                    showLinks={false}
                  />
                </section>
              )}

              <section class="wall-notes">
                {/* The empty and private states name themselves, so the column
                    title only earns its place once there are notes to label. */}
                {wall.visible && count > 0 && (
                  <h2 class="wall-col__title">Stickies · {count}</h2>
                )}

                {!wall.visible ? (
                  <div class="empty">
                    <div class="empty__emoji">🔒</div>
                    <div class="empty__title">This wall is private</div>
                    <p>
                      {wall.member.name} hasn't shared their wall yet — but you can
                      still read their profile and leave them a note.
                    </p>
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
              </section>
            </div>
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
