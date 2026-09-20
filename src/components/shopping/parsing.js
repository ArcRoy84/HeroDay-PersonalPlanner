// Free-text item parsing, purchase suggestions, and small display helpers.
import { UNITS } from './constants.js';

const VOICE_STRIP = ['add ','put ','buy ','get ','i need ','please add ','i want ','need ','pick up '];
const LIST_SUFFIX = [' to my shopping list',' to the list',' to my list',' on my list'];

function cleanText(text) {
  let t = text.toLowerCase().trim();
  for (const w of VOICE_STRIP) { if (t.startsWith(w)) { t = t.slice(w.length); break; } }
  for (const s of LIST_SUFFIX)  { if (t.endsWith(s))   { t = t.slice(0, -s.length).trim(); break; } }
  return t;
}

function parseOne(raw) {
  const t = cleanText(raw).trim();
  if (!t) return null;
  if (/^a dozen /i.test(t)) return { qty: 12, unit: 'dozen', name: t.replace(/^a dozen /i, '') };
  const pattern = new RegExp(`^(\\d+(?:\\.\\d+)?)\\s+(?:(${UNITS.join('|')})s?\\s+(?:of\\s+)?)?(.+)$`, 'i');
  const m = t.match(pattern);
  if (m) return { qty: parseFloat(m[1]), unit: (m[2] || '').toLowerCase().replace(/s$/, ''), name: m[3].trim() };
  return { qty: 1, unit: '', name: t };
}

function parseItems(raw) {
  return raw.split(/\s+and\s+|,\s*/i).map(parseOne).filter(Boolean);
}

function getSuggestions(history, items) {
  const names = new Set(items.map(i => i.name.toLowerCase()));
  const now = Date.now();
  return history
    .filter(h => !names.has(h.name.toLowerCase()))
    .map(h => ({ ...h, score: h.count * 10 - (now - new Date(h.lastBought)) / 86_400_000 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

function daysSince(iso) {
  return Math.round((Date.now() - new Date(iso)) / 86_400_000);
}

// ── Recipe photo helper ───────────────────────────────────────────────────────
// Recipe photos are stored inline as compressed base64 data URLs on the recipe
// row in the `shoppingRecipes` table. IndexedDB has far more headroom than the
// localStorage this used to live in, but downscaling still earns its keep: it
// keeps each photo in the tens of KB, so reads stay fast and a future sync has
// less to push. Do not switch these to Blobs without teaching the JSON backup
// about them: JSON.stringify turns a Blob into {}, so they would silently
// vanish from every export. The same applies to store logos.
function resizeImage(file, maxW = 640, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        // JPEG has no transparency, so a transparent PNG would come out black.
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Could not read image'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

// ── Pantry helpers ────────────────────────────────────────────────────────────
function pantryPct(item) {
  const par = item.parQty > 0 ? item.parQty : 1;
  return Math.max(0, Math.min(100, Math.round((item.qty / par) * 100)));
}

function pantryColor(item) {
  if (item.qty <= 0) return 'var(--text-muted)';
  const pct = pantryPct(item);
  if (pct >= 50) return 'var(--priority-low)';
  if (pct >= 20) return 'var(--priority-medium)';
  return 'var(--priority-high)';
}

function recipeStock(recipe, pantryByName) {
  const total = recipe.ingredients.length;
  const have = recipe.ingredients.filter(ing => {
    const p = pantryByName[ing.name.toLowerCase()];
    return p && p.qty > 0;
  }).length;
  return { have, total };
}

function formatDayLabel(dateStr, offset) {
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tomorrow';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });
}

export {
  cleanText, parseOne, parseItems, getSuggestions, daysSince,
  resizeImage, pantryPct, pantryColor, recipeStock, formatDayLabel,
};
