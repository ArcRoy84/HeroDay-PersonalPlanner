// Phone-only navigation: the bottom tab bar and the waffle (app launcher) menu.
// Both render only on phones — see useIsMobile.
import React, { useEffect } from 'react';
import { VIEWS, IconGear } from './Header.jsx';
import { NAV } from './shopping/icons.jsx';

/** The five areas, always one thumb-tap away at the bottom of the screen. */
export function MobileTabBar({ view, setView }) {
  return (
    <nav className="m-tabbar" aria-label="Main">
      {VIEWS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className={`m-tab${view === id ? ' m-tab--active' : ''}`}
          aria-current={view === id ? 'page' : undefined}
          onClick={() => setView(id)}
        >
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

/**
 * Every destination in one place, grouped: the planner areas, the shopping
 * sections (which jump straight to that section), and the app itself.
 */
export function WaffleMenu({ view, setView, shopSection, setShopSection, onOpenSettings, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const go = (fn) => () => { fn(); onClose(); };
  const planner = VIEWS.filter(v => v.id !== 'shop');

  return (
    <div className="m-waffle-backdrop" onClick={onClose}>
      <div
        className="m-waffle"
        role="dialog"
        aria-label="All sections"
        onClick={e => e.stopPropagation()}
      >
        <section className="m-waffle-group">
          <h2 className="m-waffle-heading">Planner</h2>
          <div className="m-waffle-grid">
            {planner.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                className={`m-waffle-tile${view === id ? ' m-waffle-tile--active' : ''}`}
                onClick={go(() => setView(id))}
              >
                <Icon />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="m-waffle-group">
          <h2 className="m-waffle-heading">Shopping</h2>
          <div className="m-waffle-grid">
            {NAV.map(({ id, label, short, Icon }) => (
              <button
                key={id}
                type="button"
                className={`m-waffle-tile${view === 'shop' && shopSection === id ? ' m-waffle-tile--active' : ''}`}
                onClick={go(() => { setShopSection(id); setView('shop'); })}
              >
                <Icon />
                <span>{short ?? label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="m-waffle-group">
          <h2 className="m-waffle-heading">App</h2>
          <div className="m-waffle-grid">
            <button type="button" className="m-waffle-tile" onClick={go(onOpenSettings)}>
              <IconGear />
              <span>Settings</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
