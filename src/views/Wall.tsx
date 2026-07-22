import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { stripTags } from "../../shared/text";
import type { Me, WallResponse } from "../../shared/types";
import {
  deleteSticky,
  getWall,
  markNotificationsSeen,
  setWallPublic,
  uploadAvatar,
} from "../api";
import { Avatar } from "../components/Avatar";
import { HeaderActions } from "../components/HeaderActions";
import { Icon } from "../components/Icon";
import { Nav } from "../components/Nav";
import { Pager } from "../components/Pager";
import { ProfileBody } from "../components/ProfileBody";
import { Sheet } from "../components/Sheet";
import { StickyNote } from "../components/StickyNote";
import { SystemNote } from "../components/SystemNote";
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
  const [page, setPage] = useState(1);
  const [showProfile, setShowProfile] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLElement>(null);
  const isSelf = memberId === me.id;
  /** Six rows of two on desktop, twelve stacked on a phone. */
  const PAGE_SIZE = 12;

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

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  // Deleting the last note on the last page would otherwise strand the reader
  // on an empty one.
  const safePage = Math.min(page, Math.max(1, totalPages));
  const visible = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  );

  useEffect(() => {
    setPage(1);
  }, [query]);

  /** Paging from the bottom pager should land on the first note, not wherever
   *  the old page's scroll position happened to be. */
  function goToPage(next: number) {
    setPage(next);
    notesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
    setPage(1);
    setShowProfile(false);
    load();
  }, [memberId, refreshSignal]);

  // Opening your own wall is "I've seen my notes" — stamp the watermark and
  // clear the red dot everywhere it's shown. Runs once per visit to /me.
  useEffect(() => {
    if (isSelf && me.unreadCount > 0) {
      markNotificationsSeen();
      onMeChange({ ...me, unreadCount: 0 });
    }
  }, [isSelf, memberId]);

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

  /** Back retraces the way in: a mentor is reached from the mentor directory,
   *  everyone else from the roster. Deep links land right either way. */
  function goBack() {
    navigate(wall?.isMentor ? "/mentors" : "/");
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
        onBack={goBack}
        right={
          <HeaderActions
            theme={theme}
            onToggleTheme={onToggleTheme}
            onLogout={isSelf ? onLogout : undefined}
            unreadCount={me.unreadCount}
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
                  {profile?.role && (
                    <span class="chip chip--session">{profile.role}</span>
                  )}
                  {profile?.session && (
                    <span class="chip chip--session">{profile.session} session</span>
                  )}
                  {isSelf && !me.email.endsWith("@no-email.invalid") && (
                    <span class="chip">{me.email}</span>
                  )}
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
                  {isSelf && (
                    <button
                      class="btn btn--tinted"
                      onClick={() => navigate("/me/edit")}
                    >
                      <Icon name="pencil" size={16} />
                      {profile ? "Edit profile" : "Set up your profile"}
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

              <section class="wall-notes" ref={notesRef}>
                <SystemNote />

                {/* The empty and private states name themselves, so the column
                    title only earns its place once there are notes to label. */}
                {wall.visible && count > 0 && (
                  <h2 class="wall-col__title">Stickies · {count}</h2>
                )}

                {!wall.visible ? (
                  <>
                    <div class="empty">
                      <div class="empty__emoji">🔒</div>
                      <div class="empty__title">This wall is private</div>
                      <p>
                        {wall.member.name} hasn't shared their wall yet — but you
                        can still read their profile and leave them a note.
                      </p>
                    </div>
                    {/* The wall is hidden, but a note you gave is yours to see —
                        the server returns only your own for a private wall. */}
                    {wall.stickies.length > 0 && (
                      <>
                        <h2 class="wall-col__title">
                          Note{wall.stickies.length === 1 ? "" : "s"} you left{" "}
                          {wall.member.name.split(" ")[0]}
                        </h2>
                        <div class="wall">
                          {wall.stickies.map((s) => (
                            <StickyNote
                              key={s.id}
                              sticky={s}
                              subject={wall.member.name.split(" ")[0]}
                              canDelete
                              onDelete={removeSticky}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </>
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
                      <>
                        {totalPages > 1 && (
                          <div class="wall-range" aria-live="polite">
                            Showing {(safePage - 1) * PAGE_SIZE + 1}–
                            {Math.min(safePage * PAGE_SIZE, filtered.length)} of{" "}
                            {filtered.length}
                          </div>
                        )}
                        <div class="wall">
                          {visible.map((s) => (
                            <StickyNote
                              key={s.id}
                              sticky={s}
                              subject={
                                isSelf ? null : wall.member.name.split(" ")[0]
                              }
                              // The recipient can clear any note; anyone else can
                              // still retract the ones they wrote.
                              canDelete={isSelf || s.mine}
                              onDelete={removeSticky}
                            />
                          ))}
                        </div>
                        <Pager
                          page={safePage}
                          totalPages={totalPages}
                          label="Sticky pages"
                          onPage={goToPage}
                        />
                      </>
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
              {profile.role && (
                <div class="profile-head__role">{profile.role}</div>
              )}
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
