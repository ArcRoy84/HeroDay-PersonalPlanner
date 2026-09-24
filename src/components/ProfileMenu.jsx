// Desktop-only: the avatar + name in the top-right corner and the dropdown it
// opens. Settings lives inside this menu instead of its own header icon, so
// "everything about me/this app" is behind one entry point — mirrors the
// account menu pattern most web apps use.
import React, { useEffect, useState } from 'react';
import { Avatar, ProfileEditor, AccountRow } from './ProfileCard.jsx';
import { IconGear } from './Header.jsx';

const IconChevronDown = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="2.5 4.5 6 8 9.5 4.5" />
  </svg>
);

export default function ProfileMenu({
  name, setName, photo, setPhoto, onOpenSettings, email, onSignOut,
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="profile-menu">
      <button
        type="button"
        className="profile-trigger"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Avatar name={name} photo={photo} size={28} />
        <span className="profile-name">{name || 'You'}</span>
        <IconChevronDown />
      </button>

      {open && (
        <>
          <div className="profile-menu-backdrop" onClick={() => setOpen(false)} />
          <div className="profile-menu-panel" role="dialog" aria-label="Profile">
            <AccountRow email={email} onSignOut={onSignOut} />

            <div className="profile-menu-divider" />

            <ProfileEditor name={name} setName={setName} photo={photo} setPhoto={setPhoto} />

            <div className="profile-menu-divider" />

            <button
              type="button"
              className="profile-menu-item"
              onClick={() => { setOpen(false); onOpenSettings(); }}
            >
              <IconGear />
              Settings
            </button>
          </div>
        </>
      )}
    </div>
  );
}
