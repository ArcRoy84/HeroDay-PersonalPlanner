// Starter budget categories for a new user. Extracted from BudgetView so the
// database can seed them at boot rather than the component falling back to them
// at read time — with persistence in Dexie, a user who deletes every category
// must not find them restored on next launch.
export const DEFAULT_BUDGET_CATEGORIES = [
  { id: 'housing',       name: 'Housing & Rent', emoji: '🏠', type: 'need',   allocated: 0 },
  { id: 'utilities',     name: 'Utilities',      emoji: '💡', type: 'need',   allocated: 0 },
  { id: 'groceries',     name: 'Groceries',      emoji: '🛒', type: 'need',   allocated: 0 },
  { id: 'transport',     name: 'Transportation', emoji: '🚗', type: 'need',   allocated: 0 },
  { id: 'insurance',     name: 'Insurance',      emoji: '🛡️', type: 'need',   allocated: 0 },
  { id: 'dining',        name: 'Dining Out',     emoji: '🍽️', type: 'want',   allocated: 0 },
  { id: 'entertainment', name: 'Entertainment',  emoji: '🎬', type: 'want',   allocated: 0 },
  { id: 'subscriptions', name: 'Subscriptions',  emoji: '📺', type: 'want',   allocated: 0 },
  { id: 'shopping',      name: 'Shopping',       emoji: '🛍️', type: 'want',   allocated: 0 },
  { id: 'savings',       name: 'Savings Goals',  emoji: '💰', type: 'saving', allocated: 0 },
  { id: 'other',         name: 'Other',          emoji: '📦', type: 'want',   allocated: 0 },
];
