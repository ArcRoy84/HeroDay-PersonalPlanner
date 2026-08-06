import React, { useState, useEffect, useCallback } from 'react';

const WMO = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Icy fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Rain showers', 81: 'Showers', 82: 'Heavy showers',
  85: 'Snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm',
};

function wmoIcon(code, isDay) {
  if (code <= 1)                return isDay ? 'sun' : 'moon';
  if (code === 2)               return 'partly-cloudy';
  if (code === 3)               return 'cloud';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 67) return 'rain';
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 80 && code <= 82) return 'rain';
  if (code >= 85 && code <= 86) return 'snow';
  if (code >= 95)               return 'thunder';
  return 'cloud';
}

function WIcon({ type }) {
  switch (type) {
    case 'sun': return (
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none" strokeLinecap="round">
        <circle cx="22" cy="22" r="8" fill="#F59E0B" />
        <g stroke="#F59E0B" strokeWidth="2">
          <line x1="22" y1="4"  x2="22" y2="9" />
          <line x1="22" y1="35" x2="22" y2="40" />
          <line x1="4"  y1="22" x2="9"  y2="22" />
          <line x1="35" y1="22" x2="40" y2="22" />
          <line x1="8.4"  y1="8.4"  x2="12"  y2="12" />
          <line x1="32"   y1="32"   x2="35.6" y2="35.6" />
          <line x1="8.4"  y1="35.6" x2="12"   y2="32" />
          <line x1="32"   y1="12"   x2="35.6" y2="8.4" />
        </g>
      </svg>
    );
    case 'moon': return (
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
        <path d="M32 30A15 15 0 0 1 14 12a16 16 0 1 0 18 18z" fill="var(--accent)" opacity="0.8"/>
      </svg>
    );
    case 'partly-cloudy': return (
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none" strokeLinecap="round">
        <circle cx="16" cy="16" r="6" fill="#F59E0B" />
        <g stroke="#F59E0B" strokeWidth="1.8">
          <line x1="16" y1="5"  x2="16" y2="8" />
          <line x1="16" y1="24" x2="16" y2="27" opacity="0.3"/>
          <line x1="5"  y1="16" x2="8"  y2="16" />
          <line x1="24" y1="16" x2="27" y2="16" opacity="0.3"/>
          <line x1="8.5" y1="8.5"  x2="10.7" y2="10.7" />
          <line x1="21.3" y1="21.3" x2="23.5" y2="23.5" opacity="0.3"/>
        </g>
        <path d="M11 38a9 9 0 0 1 0-18h2.5a11 11 0 0 1 21 6 8 8 0 0 1-2 12H11z"
              fill="var(--bg-elevated)" stroke="var(--text-muted)" strokeWidth="1.4"/>
      </svg>
    );
    case 'cloud': return (
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
        <path d="M11 34a10 10 0 0 1 0-20h2.5a12 12 0 0 1 23 7 9 9 0 0 1-2 13H11z"
              fill="var(--bg-elevated)" stroke="var(--text-muted)" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    );
    case 'fog': return (
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none" stroke="var(--text-muted)" strokeWidth="1.8" strokeLinecap="round">
        <path d="M11 15a9 9 0 0 1 22 0" />
        <line x1="5"  y1="21" x2="39" y2="21" />
        <line x1="8"  y1="28" x2="36" y2="28" />
        <line x1="13" y1="35" x2="31" y2="35" />
      </svg>
    );
    case 'rain': return (
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none" strokeLinecap="round">
        <path d="M11 26a9 9 0 0 1 0-18h2.5a11 11 0 0 1 21 6 7 7 0 0 1-2 12H11z"
              fill="var(--bg-elevated)" stroke="var(--text-muted)" strokeWidth="1.4"/>
        <g stroke="var(--accent)" strokeWidth="2">
          <line x1="14" y1="32" x2="12" y2="40" />
          <line x1="22" y1="32" x2="20" y2="40" />
          <line x1="30" y1="32" x2="28" y2="40" />
        </g>
      </svg>
    );
    case 'snow': return (
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none" strokeLinecap="round">
        <path d="M11 26a9 9 0 0 1 0-18h2.5a11 11 0 0 1 21 6 7 7 0 0 1-2 12H11z"
              fill="var(--bg-elevated)" stroke="var(--text-muted)" strokeWidth="1.4"/>
        <g stroke="var(--accent)" strokeWidth="1.8">
          <line x1="14" y1="31" x2="14" y2="39" /><line x1="11" y1="35" x2="17" y2="35" />
          <line x1="22" y1="31" x2="22" y2="39" /><line x1="19" y1="35" x2="25" y2="35" />
          <line x1="30" y1="31" x2="30" y2="39" /><line x1="27" y1="35" x2="33" y2="35" />
        </g>
      </svg>
    );
    case 'thunder': return (
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 26a9 9 0 0 1 0-18h2.5a11 11 0 0 1 21 6 7 7 0 0 1-2 12H11z"
              fill="var(--bg-elevated)" stroke="var(--text-muted)" strokeWidth="1.4"/>
        <polyline points="26 30 20 39 27 39 22 44" stroke="#F59E0B" strokeWidth="2.2"/>
      </svg>
    );
    default: return null;
  }
}

async function fetchWeather(lat, lon, unit) {
  const tUnit = unit === 'celsius' ? 'celsius' : 'fahrenheit';
  const wUnit = unit === 'celsius' ? 'kmh' : 'mph';
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,is_day` +
    `&temperature_unit=${tUnit}&wind_speed_unit=${wUnit}&timezone=auto`
  );
  if (!res.ok) throw new Error('fetch failed');
  return res.json();
}

export default function WeatherWidget({ location, unit = 'fahrenheit' }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const load = useCallback(async () => {
    if (!location) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWeather(location.lat, location.lon, unit);
      setWeather(data.current);
    } catch {
      setError('Unable to fetch weather');
    } finally {
      setLoading(false);
    }
  }, [location, unit]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  if (!location) {
    return (
      <div className="dash-tile tile-weather tile-weather-empty">
        <div className="weather-empty-icon">🌤️</div>
        <p className="weather-empty-text">Set your location in Settings to see weather</p>
      </div>
    );
  }

  const code   = weather?.weather_code ?? null;
  const icon   = code !== null ? wmoIcon(code, weather.is_day !== 0) : null;
  const label  = code !== null ? (WMO[code] ?? 'Unknown') : null;
  const uSym   = unit === 'celsius' ? '°C' : '°F';
  const wLabel = unit === 'celsius' ? 'km/h' : 'mph';

  return (
    <div className="dash-tile tile-weather">
      <div className="weather-header">
        <span className="tile-label-top" style={{ margin: 0 }}>Weather</span>
        <button className="weather-refresh-btn" onClick={load} disabled={loading} title="Refresh">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.5 2.5A5 5 0 1 0 11 7" />
            <polyline points="10.5 2.5 10.5 5.5 7.5 5.5" />
          </svg>
        </button>
      </div>

      {loading && !weather && <div className="weather-loading">Loading…</div>}
      {error && (
        <div className="weather-error">
          {error} ·{' '}
          <button onClick={load} className="weather-retry">Retry</button>
        </div>
      )}

      {weather && (
        <>
          <div className="weather-main">
            <div className={loading ? 'weather-icon weather-icon--fading' : 'weather-icon'}>
              {icon && <WIcon type={icon} />}
            </div>
            <div className="weather-temps">
              <span className="weather-temp">{Math.round(weather.temperature_2m)}{uSym}</span>
              <span className="weather-feels">Feels {Math.round(weather.apparent_temperature)}{uSym}</span>
            </div>
          </div>

          <div className="weather-condition">{label}</div>

          <div className="weather-stats">
            <span className="weather-stat">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M6 1C6 1 10 5.5 10 7.5a4 4 0 0 1-8 0C2 5.5 6 1 6 1z" />
              </svg>
              {Math.round(weather.relative_humidity_2m)}%
            </span>
            <span className="weather-stat">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M1 4h7a2 2 0 0 0 0-4 2 2 0 0 0-2 2" />
                <path d="M1 8h5a2 2 0 0 1 0 4 2 2 0 0 1-2-2" />
              </svg>
              {Math.round(weather.wind_speed_10m)} {wLabel}
            </span>
          </div>

          <div className="weather-location-name">{location.name}</div>
        </>
      )}
    </div>
  );
}
