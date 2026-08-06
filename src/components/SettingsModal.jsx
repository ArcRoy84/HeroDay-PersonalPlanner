import React, { useState, useEffect } from 'react';

const THEMES = [
  { id: 'dark',         label: 'Default Dark',  sub: 'Purple · Dark',  bg: '#08080f', surface: '#111119', accent: '#7c66ff' },
  { id: 'light',        label: 'Default Light', sub: 'Purple · Light', bg: '#f2f2fa', surface: '#ffffff', accent: '#7c66ff' },
  { id: 'heroday',      label: 'HeroDay Dark',  sub: 'Teal · Dark',    bg: '#0f0f0f', surface: '#1a1a1a', accent: '#1D9E75' },
  { id: 'heroday-light',label: 'HeroDay Light', sub: 'Teal · Light',   bg: '#F5F4EE', surface: '#FEFDF8', accent: '#1D9E75' },
];

const IconGear = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
    <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.892 3.433-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.892-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319z"/>
  </svg>
);

const IconCheck = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="2 5 4.2 7.5 8 2.5" />
  </svg>
);

const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <line x1="3" y1="3" x2="11" y2="11" />
    <line x1="11" y1="3" x2="3" y2="11" />
  </svg>
);

// ── Location section ──────────────────────────────────────────────────────────
function LocationSection({ location, setLocation, unit, setUnit }) {
  const [query,      setQuery]      = useState('');
  const [results,    setResults]    = useState([]);
  const [searching,  setSearching]  = useState(false);
  const [geoStatus,  setGeoStatus]  = useState('idle'); // idle | detecting | done | error | unsupported

  const handleAutoDetect = () => {
    const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (!isSecure) { setGeoStatus('https-required'); return; }
    if (!navigator.geolocation) { setGeoStatus('unsupported'); return; }
    setGeoStatus('detecting');
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}`
          );
          const d = await res.json();
          const city    = d.address?.city || d.address?.town || d.address?.village || d.address?.county || 'My Location';
          const country = d.address?.country_code?.toUpperCase() || '';
          setLocation({ lat: coords.latitude, lon: coords.longitude, name: country ? `${city}, ${country}` : city });
        } catch {
          setLocation({ lat: coords.latitude, lon: coords.longitude, name: 'My Location' });
        }
        setGeoStatus('done');
      },
      (err) => setGeoStatus(err.code === 1 ? 'denied' : 'error'),
      { timeout: 10000, maximumAge: 60000 }
    );
  };

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`
      );
      const d = await res.json();
      setResults(d.results || []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const pick = (r) => {
    const name = [r.name, r.admin1, r.country].filter(Boolean).join(', ');
    setLocation({ lat: r.latitude, lon: r.longitude, name });
    setQuery('');
    setResults([]);
  };

  return (
    <section>
      <div className="settings-section-title">Location &amp; Weather</div>

      {/* Unit toggle */}
      <div className="loc-unit-row">
        <span className="loc-unit-label">Temperature unit</span>
        <div className="loc-unit-toggle">
          <button className={unit === 'fahrenheit' ? 'active' : ''} onClick={() => setUnit('fahrenheit')}>°F</button>
          <button className={unit === 'celsius'    ? 'active' : ''} onClick={() => setUnit('celsius')}>°C</button>
        </div>
      </div>

      {/* Current location chip */}
      {location && (
        <div className="loc-current">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="6" cy="5" r="2" />
            <path d="M6 1a4 4 0 0 1 4 4c0 3-4 7-4 7S2 8 2 5a4 4 0 0 1 4-4z" />
          </svg>
          <span className="loc-current-name">{location.name}</span>
          <button className="loc-clear-btn" onClick={() => setLocation(null)} title="Clear location">
            <IconX />
          </button>
        </div>
      )}

      {/* Auto-detect */}
      <button
        className="loc-detect-btn"
        onClick={handleAutoDetect}
        disabled={geoStatus === 'detecting'}
      >
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
          <circle cx="7" cy="7" r="2.5" />
          <line x1="7" y1="1" x2="7" y2="3" />
          <line x1="7" y1="11" x2="7" y2="13" />
          <line x1="1" y1="7" x2="3" y2="7" />
          <line x1="11" y1="7" x2="13" y2="7" />
        </svg>
        {geoStatus === 'detecting' ? 'Detecting…' : 'Use my location'}
      </button>
      {['error', 'denied', 'unsupported', 'https-required'].includes(geoStatus) && (
        <p className="loc-geo-error">
          {geoStatus === 'denied'         && 'Location permission denied. In your browser/Android settings, allow location for this site.'}
          {geoStatus === 'error'          && 'Could not get location. Please search manually below.'}
          {geoStatus === 'unsupported'    && 'Geolocation not supported in this browser.'}
          {geoStatus === 'https-required' && 'Location requires a secure connection (HTTPS). Search manually below.'}
        </p>
      )}

      {/* City search */}
      <div className="loc-search-row">
        <input
          className="loc-search-input"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="Search city…"
        />
        <button
          className="loc-search-btn"
          onClick={search}
          disabled={searching || !query.trim()}
        >
          {searching ? '…' : 'Search'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="loc-results">
          {results.map(r => (
            <button key={r.id} className="loc-result-item" onClick={() => pick(r)}>
              <span className="loc-result-city">{r.name}</span>
              <span className="loc-result-region">{[r.admin1, r.country].filter(Boolean).join(', ')}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function SettingsModal({ theme, setTheme, location, setLocation, unit, setUnit, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="settings-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="settings-modal" role="dialog" aria-modal="true" aria-label="Settings">
        <div className="settings-modal-header">
          <div className="settings-modal-title">
            <IconGear />
            Settings
          </div>
          <button className="settings-close" onClick={onClose} aria-label="Close settings">
            <IconX />
          </button>
        </div>

        <div className="settings-body">
          {/* Appearance */}
          <section>
            <div className="settings-section-title">Appearance</div>
            <div className="theme-grid">
              {THEMES.map(t => (
                <button
                  key={t.id}
                  className={`theme-card ${theme === t.id ? 'active' : ''}`}
                  onClick={() => setTheme(t.id)}
                >
                  <div className="theme-card-check"><IconCheck /></div>
                  <div className="theme-preview">
                    <div className="theme-preview-swatch" style={{ background: t.bg }} />
                    <div className="theme-preview-swatch" style={{ background: t.surface }} />
                    <div className="theme-preview-accent" style={{ background: t.accent }} />
                  </div>
                  <div>
                    <div className="theme-card-label">{t.label}</div>
                    <div className="theme-card-sub">{t.sub}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <div className="settings-divider" />

          {/* Location & Weather */}
          <LocationSection
            location={location}
            setLocation={setLocation}
            unit={unit}
            setUnit={setUnit}
          />
        </div>
      </div>
    </div>
  );
}
