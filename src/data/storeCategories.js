// Starter store categories. Ids are fixed strings, not generated, so seeding is
// idempotent and a store's categoryId stays valid across a backup restore.
//
// 'other' is special: it is the fallback a store moves to when its category is
// deleted, so it can never be deleted itself. See storeOps.saveStoreCategories.
export const OTHER_STORE_CATEGORY_ID = 'other';

export const DEFAULT_STORE_CATEGORIES = [
  { id: 'supermarket', label: 'Supermarket',       emoji: '🛒', color: '#97C459' },
  { id: 'bakery',      label: 'Bakery',            emoji: '🥖', color: '#EF9F27' },
  { id: 'butcher',     label: 'Butcher / Seafood', emoji: '🥩', color: '#E24B4A' },
  { id: 'market',      label: 'Farmers Market',    emoji: '🥕', color: '#84cc16' },
  { id: 'warehouse',   label: 'Warehouse Club',    emoji: '📦', color: '#818cf8' },
  { id: 'convenience', label: 'Convenience Store', emoji: '🏪', color: '#22d3ee' },
  { id: 'pharmacy',    label: 'Pharmacy',          emoji: '💊', color: '#14b8a6' },
  { id: 'hardware',    label: 'Hardware Store',    emoji: '🔨', color: '#f97316' },
  { id: 'department',  label: 'Department Store',  emoji: '🏬', color: '#8b5cf6' },
  { id: 'other',       label: 'Other',             emoji: '📍', color: '#9ca3af' },
];

// Offered as one-click choices in the store form's icon picker.
export const STORE_EMOJIS = [
  '🏪', '🛒', '🏬', '🏢', '🥖', '🥩', '🐟', '🥕', '🍎', '🧀', '🍷', '☕',
  '💊', '🔨', '🔧', '🌱', '🐾', '📚', '👕', '👟', '💻', '🎁', '🧴', '📦',
];
