import type { RefObject } from "preact";
import type { JSX } from "preact/jsx-runtime";
import type { WallResponse, Me } from "../../shared/types";
import { Avatar } from "./Avatar";
import { Spinner } from "./controls";
import { Icon } from "./Icon";

export interface WallProfileHeaderProps {
  wall: WallResponse;
  profile: NonNullable<WallResponse["profile"]> | null;
  me: Me;
  isSelf: boolean;
  uploading: boolean;
  fileRef: RefObject<HTMLInputElement>;
  onPickAvatar: (e: JSX.TargetedEvent<HTMLInputElement>) => void;
  setShowProfile: (show: boolean) => void;
  onGive: (id: string) => void;
}

export function WallProfileHeader({
  wall,
  profile,
  me,
  isSelf,
  uploading,
  fileRef,
  onPickAvatar,
  setShowProfile,
  onGive,
}: WallProfileHeaderProps) {
  return (
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
              class="btn btn--tinted hidden-on-desktop"
              onClick={() => setShowProfile(true)}
            >
              <Icon name="person" size={16} />
              {isSelf ? "Your profile" : "Read profile"}
            </button>
          )}
          {!isSelf && (
            <button class="btn btn--filled" onClick={() => onGive(wall.member.id)}>
              <Icon name="plus" size={16} />
              Give a sticky
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
