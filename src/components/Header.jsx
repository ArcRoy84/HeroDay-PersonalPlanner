import React from 'react';
import { formatDate, navigateDate, getToday } from '../utils/helpers.js';

const IconChecklist = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <polyline points="3 5 5.5 7.5 9.5 3.5" />
    <line x1="11" y1="5.5" x2="14" y2="5.5" />
    <polyline points="3 10 5.5 12.5 9.5 8.5" />
    <line x1="11" y1="10.5" x2="14" y2="10.5" />
  </svg>
);

const IconTimeline = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <line x1="2" y1="4" x2="2" y2="12" />
    <circle cx="2" cy="5" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="2" cy="9" r="1.2" fill="currentColor" stroke="none" />
    <line x1="5" y1="5" x2="13" y2="5" />
    <line x1="5" y1="9" x2="11" y2="9" />
  </svg>
);

const IconStats = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <polyline points="2 12 5 8 8 10 11 5 14 7" />
  </svg>
);

const IconLearn = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 3L14 6.5v5L8 15 2 11.5v-5L8 3z" />
    <path d="M8 3v12" />
    <path d="M2 6.5l6 3.5 6-3.5" />
  </svg>
);

const IconCart = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 1h2.5l2 8h7.5l1.5-5H5" />
    <circle cx="7.5" cy="13.5" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="12.5" cy="13.5" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);

const IconGear = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
    <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.892 3.433-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.892-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319z"/>
  </svg>
);

const IconChevronLeft = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <polyline points="10 4 6 8 10 12" />
  </svg>
);

const IconChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <polyline points="6 4 10 8 6 12" />
  </svg>
);

const VIEWS = [
  { id: 'checklist', label: 'Checklist', Icon: IconChecklist, key: '1' },
  { id: 'timeline',  label: 'Timeline',  Icon: IconTimeline,  key: '2' },
  { id: 'stats',     label: 'Review',    Icon: IconStats,     key: '3' },
  { id: 'learn',     label: 'Learning',  Icon: IconLearn,     key: '4' },
  { id: 'shop',      label: 'Shopping',  Icon: IconCart,      key: '5' },
];

export default function Header({ view, setView, currentDate, setCurrentDate, onOpenSettings }) {
  const isToday   = currentDate === getToday();
  const dateLabel = isToday ? 'Today' : formatDate(currentDate);

  return (
    <header className="header">
      <div className="header-brand">
        <div className="brand-icon">
          {/* HeroDay shield logo */}
          <svg width="22" height="26" viewBox="0 0 22 26" fill="none">
            <defs>
              <linearGradient id="hd-shield-grad" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
                <stop offset="0%" stopColor="#1D9E75" />
                <stop offset="100%" stopColor="#0F6E56" />
              </linearGradient>
            </defs>
            <path d="M11 0 L22 4 L22 15 Q22 23 11 26 Q0 23 0 15 L0 4 Z" fill="url(#hd-shield-grad)" />
            <path d="M11 1.5 L20 5 L20 15 Q20 21.5 11 24 Q2 21.5 2 15 L2 5 Z" fill="#E1F5EE" opacity="0.12" />
            <text x="11" y="14.5" textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#E1F5EE" fontFamily="system-ui, -apple-system, sans-serif">HD</text>
            <circle cx="7"  cy="20.5" r="2.2" fill="#97C459" />
            <circle cx="11" cy="20.5" r="2.2" fill="#EF9F27" />
            <circle cx="15" cy="20.5" r="2.2" fill="#5DCAA5" />
          </svg>
        </div>
        <div className="brand-name-block">
          <span className="brand-name">HeroDay</span>
          <span className="brand-tagline">OWN YOUR DAY</span>
        </div>
      </div>

      <nav className="header-nav">
        {VIEWS.map(({ id, label, Icon, key }) => (
          <button
            key={id}
            className={`nav-tab ${view === id ? 'active' : ''}`}
            onClick={() => setView(id)}
            title={`${label} (${key})`}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="header-controls">
        <div className="date-nav">
          <button
            className="date-nav-btn"
            onClick={() => setCurrentDate(d => navigateDate(d, -1))}
            title="Previous day (←)"
          >
            <IconChevronLeft />
          </button>
          <button
            className={`date-label ${isToday ? 'is-today' : ''}`}
            onClick={() => setCurrentDate(getToday())}
            title="Go to today"
          >
            {dateLabel}
          </button>
          <button
            className="date-nav-btn"
            onClick={() => setCurrentDate(d => navigateDate(d, +1))}
            title="Next day (→)"
          >
            <IconChevronRight />
          </button>
        </div>

        <button
          className="settings-btn"
          onClick={onOpenSettings}
          title="Settings"
        >
          <IconGear />
        </button>
      </div>
    </header>
  );
}
