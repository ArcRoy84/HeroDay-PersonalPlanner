// Local profile identity: the avatar shown in the header/waffle menu, and the
// small editor (photo + name) used by both. There is no account yet — this is
// a per-device display identity that a future sign-in replaces.
import React, { useRef, useState } from 'react';
import { resizeImage } from './shopping/parsing.js';
import { isSafeImage } from '../utils/stores';

// A profile photo never shows larger than ~44px, so 160px is sharp at 3x
// without bloating IndexedDB or a backup file — same target as a store logo.
const PHOTO_MAX_PX = 160;
const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

function initials(name) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
}

const IconUser = () => (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="5.2" r="2.7" />
    <path d="M2.5 14c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
  </svg>
);

const IconCamera = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 5.5h2.2L5.3 4h5.4l1.1 1.5H14v7.5H2V5.5z" />
    <circle cx="8" cy="9" r="2.2" />
  </svg>
);

const IconPencil = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 2.5l2.5 2.5L5 13.5H2.5V11L11 2.5z" />
  </svg>
);

const IconLogOut = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 14H3.5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1H6" />
    <path d="M10.5 11.5 14 8l-3.5-3.5" />
    <path d="M14 8H6" />
  </svg>
);

/** Circular photo, or an initials/generic fallback. Used at any size. */
export function Avatar({ name, photo, size = 32 }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) };
  if (photo && isSafeImage(photo)) {
    return <img className="profile-avatar" style={style} src={photo} alt="" />;
  }
  const label = initials(name);
  return (
    <span className="profile-avatar profile-avatar-fallback" style={style}>
      {label || <IconUser />}
    </span>
  );
}

/**
 * The signed-in account (email) and sign-out action. Shown above the local
 * ProfileEditor in both the desktop dropdown and the mobile waffle menu —
 * this is the real account; the editor below it is still a per-device
 * display identity, since Dexie data doesn't sync across devices yet.
 */
export function AccountRow({ email, onSignOut }) {
  return (
    <div className="account-row">
      <span className="account-email" title={email}>{email}</span>
      <button type="button" className="account-signout" onClick={onSignOut}>
        <IconLogOut />
        Sign out
      </button>
    </div>
  );
}

/**
 * The name + photo editor. Shared by the desktop profile dropdown and the
 * mobile waffle menu so there is exactly one place this logic lives.
 */
export function ProfileEditor({ name, setName, photo, setPhoto }) {
  const [editingName, setEditingName] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const commitName = () => {
    setName(draft.trim());
    setEditingName(false);
  };

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please choose an image file.'); return; }
    if (file.size > PHOTO_MAX_BYTES) { setError('That image is too large (10 MB max).'); return; }
    setError('');
    try {
      setPhoto(await resizeImage(file, PHOTO_MAX_PX, 0.85));
    } catch {
      setError('Could not read that image. Try a different file.');
    }
  }

  return (
    <div className="profile-editor">
      <div className="profile-editor-row">
        <button
          type="button"
          className="profile-avatar-btn"
          onClick={() => fileRef.current?.click()}
          title="Change photo"
          aria-label="Change photo"
        >
          <Avatar name={name} photo={photo} size={44} />
          <span className="profile-avatar-edit"><IconCamera /></span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />

        <div className="profile-editor-fields">
          {editingName ? (
            <input
              className="profile-name-input"
              value={draft}
              autoFocus
              placeholder="Your name"
              maxLength={60}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitName();
                if (e.key === 'Escape') { setDraft(name); setEditingName(false); }
              }}
            />
          ) : (
            <button
              type="button"
              className="profile-name-edit"
              onClick={() => { setDraft(name); setEditingName(true); }}
            >
              <span>{name || 'Add your name'}</span>
              <IconPencil />
            </button>
          )}
          <span className="profile-editor-caption">Local profile · this device only</span>
        </div>
      </div>

      {photo && (
        <button type="button" className="profile-remove-photo" onClick={() => setPhoto(null)}>
          Remove photo
        </button>
      )}
      {error && <p className="profile-editor-error">{error}</p>}
    </div>
  );
}
