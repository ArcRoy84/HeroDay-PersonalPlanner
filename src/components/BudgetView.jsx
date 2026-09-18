import React, { useState, useMemo, useCallback } from 'react';
import { useBudget } from '../hooks/useBudget';
import { generateId, getToday } from '../utils/helpers.js';

// ── Icons ─────────────────────────────────────────────────────────────────────
const IconX       = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/></svg>;
const IconPlus     = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="6" y1="1" x2="6" y2="11"/><line x1="1" y1="6" x2="11" y2="6"/></svg>;
const IconPencil   = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M9 1.5L11.5 4l-7 7H2V8.5l7-7z"/></svg>;
const IconTrash    = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><line x1="1.5" y1="3.5" x2="11.5" y2="3.5"/><path d="M4.5 3.5V2.5h4v1"/><path d="M2.5 3.5l.7 7.5h6.6l.7-7.5"/></svg>;
const IconCheck    = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2 7 6 11 12 3"/></svg>;
const IconWallet   = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="16" height="12" rx="2"/><path d="M1 8.5h16"/><circle cx="13.5" cy="12" r="1.5" fill="currentColor" stroke="none"/><path d="M5 4V3a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1"/></svg>;
const IconIncome   = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 2v9M3.5 7.5L7 11l3.5-3.5"/><path d="M2 12.5h10"/></svg>;
const IconBill     = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="1.5" width="10" height="11" rx="1.2"/><path d="M4.5 5h5M4.5 7.5h5M4.5 10h3"/></svg>;
const IconCart     = () => <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1h2.5l2.5 9h8.5l1.5-5.5H5"/><circle cx="8" cy="15.5" r="1.5" fill="currentColor" stroke="none"/><circle cx="14" cy="15.5" r="1.5" fill="currentColor" stroke="none"/></svg>;


const BILL_TEMPLATES = [
  { name: 'Rent / Mortgage',  emoji: '🏠', categoryId: 'housing' },
  { name: 'Electricity',      emoji: '💡', categoryId: 'utilities' },
  { name: 'Water',            emoji: '🚰', categoryId: 'utilities' },
  { name: 'Internet',         emoji: '📶', categoryId: 'utilities' },
  { name: 'Phone',            emoji: '📱', categoryId: 'utilities' },
  { name: 'Car Payment',      emoji: '🚗', categoryId: 'transport' },
  { name: 'Auto Insurance',   emoji: '🛡️', categoryId: 'insurance' },
  { name: 'Health Insurance', emoji: '⚕️', categoryId: 'insurance' },
  { name: 'Streaming',        emoji: '📺', categoryId: 'subscriptions' },
  { name: 'Gym Membership',   emoji: '💪', categoryId: 'subscriptions' },
  { name: 'Student Loan',     emoji: '🎓', categoryId: 'other' },
];

const METHODOLOGIES = [
  { id: 'zero-based', label: 'Zero-Based',  blurb: 'Give every dollar a job until nothing is left unassigned.' },
  { id: '50-30-20',   label: '50/30/20',    blurb: '50% needs, 30% wants, 20% savings — a simple guardrail.' },
  { id: 'envelope',   label: 'Envelopes',   blurb: 'Spend from fixed pots per category; when it’s empty, it’s empty.' },
];

const RULE_502030 = { need: 0.5, want: 0.3, saving: 0.2 };
const TYPE_COLOR   = { need: 'var(--accent)', want: 'var(--priority-medium)', saving: 'var(--priority-low)' };
const TYPE_LABEL   = { need: 'Needs', want: 'Wants', saving: 'Savings' };
const FREQ_MONTHLY_MULT = { monthly: 1, weekly: 4.345, biweekly: 2.1725, yearly: 1 / 12 };

const EXPENSE_KEYWORDS = {
  housing:       ['rent', 'mortgage', 'landlord', 'hoa'],
  utilities:     ['electric', 'water bill', 'gas bill', 'internet', 'wifi', 'phone bill', 'utility', 'utilities'],
  groceries:     ['grocery', 'groceries', 'supermarket', 'trader joe', 'whole foods', 'safeway', 'kroger', 'costco'],
  transport:     ['uber', 'lyft', 'gas', 'fuel', 'parking', 'transit', 'metro', 'train', 'taxi'],
  insurance:     ['insurance', 'premium'],
  dining:        ['restaurant', 'coffee', 'starbucks', 'lunch', 'dinner', 'breakfast', 'cafe', 'takeout', 'doordash', 'ubereats', 'grubhub'],
  entertainment: ['movie', 'concert', 'netflix', 'spotify', 'hulu', 'disney', 'theater', 'game', 'steam'],
  subscriptions: ['subscription', 'membership', 'gym', 'prime', 'icloud', 'dropbox'],
  shopping:      ['amazon', 'target', 'mall', 'clothes', 'shoes', 'store'],
  savings:       ['savings', 'deposit'],
};

function categorizeExpense(text) {
  const lower = text.toLowerCase();
  for (const [catId, kws] of Object.entries(EXPENSE_KEYWORDS)) {
    if (kws.some(k => lower.includes(k))) return catId;
  }
  return 'other';
}

// Heuristic single-line parser — NOT real AI/NLU, just regex + keyword rules,
// mirroring the same trick used for the shopping-list quick-add input.
function parseExpenseText(raw) {
  const t = raw.trim();
  const amountMatch = t.match(/\$?(\d+(?:\.\d{1,2})?)/);
  if (!amountMatch) return null;
  const amount = parseFloat(amountMatch[1]);
  let rest = (t.slice(0, amountMatch.index) + t.slice(amountMatch.index + amountMatch[0].length)).trim();
  rest = rest.replace(/^(spent|paid|spend)\s+/i, '').replace(/^(on|for)\s+/i, '');
  const atMatch = rest.match(/\bat\s+(.+)$/i);
  let payee = '', note = '';
  if (atMatch) {
    payee = atMatch[1].trim();
    note  = rest.slice(0, atMatch.index).replace(/\bon\b\s*$/i, '').trim();
  } else if (rest) {
    payee = rest;
  }
  return { amount, payee: payee || 'Unknown', note };
}

function getRecentPayees(expenses) {
  const map = {};
  expenses.forEach(e => {
    if (!e.payee) return;
    const key = e.payee.toLowerCase();
    if (!map[key]) map[key] = { payee: e.payee, categoryId: e.categoryId, count: 0, lastDate: e.date };
    map[key].count++;
    if (e.date >= map[key].lastDate) { map[key].lastDate = e.date; map[key].categoryId = e.categoryId; }
  });
  const now = Date.now();
  return Object.values(map)
    .map(p => ({ ...p, score: p.count * 10 - (now - new Date(p.lastDate)) / 86_400_000 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

// ── ConfirmModal (local copy — keeps this module self-contained) ──────────────
function ConfirmModal({ title, message, confirmLabel = 'Delete', onConfirm, onClose }) {
  return (
    <div className="shop-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="shop-dialog">
        <div className="shop-dialog-header">
          <h4 className="shop-dialog-title">{title}</h4>
          <button className="sic-act" onClick={onClose}><IconX /></button>
        </div>
        <p className="shop-dialog-body-text">{message}</p>
        <div className="shop-dialog-actions">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ── CategoryEnvelopeCard ────────────────────────────────────────────────────────
function CategoryEnvelopeCard({ cat, spent, onAllocate }) {
  const allocated = cat.allocated || 0;
  const remaining = allocated - spent;
  const pct = allocated > 0 ? Math.min(100, Math.round((spent / allocated) * 100)) : (spent > 0 ? 100 : 0);
  const color = spent > allocated && allocated > 0
    ? 'var(--priority-high)'
    : pct >= 80 ? 'var(--priority-medium)' : 'var(--priority-low)';

  return (
    <div className="budget-envelope-card" style={{ '--tc': TYPE_COLOR[cat.type] }}>
      <div className="budget-envelope-top">
        <span className="budget-envelope-emoji">{cat.emoji}</span>
        <span className="budget-envelope-name">{cat.name}</span>
        <span className="budget-envelope-type">{TYPE_LABEL[cat.type]}</span>
      </div>
      <div className="budget-envelope-amounts">
        <span>Spent ${spent.toFixed(2)}</span>
        <span className={remaining < 0 ? 'budget-envelope-remaining--over' : ''}>
          {remaining < 0 ? `$${Math.abs(remaining).toFixed(2)} over` : `$${remaining.toFixed(2)} left`}
        </span>
      </div>
      <div className="budget-envelope-bar-track">
        <div className="budget-envelope-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="budget-envelope-alloc-row">
        <label>Allocated</label>
        <div className="budget-envelope-alloc-input">
          <span>$</span>
          <input type="number" min="0" step="5" value={allocated}
            onChange={e => onAllocate(cat.id, parseFloat(e.target.value) || 0)} />
        </div>
      </div>
    </div>
  );
}

// ── ManageBudgetCategoriesModal ─────────────────────────────────────────────────
function ManageBudgetCategoriesModal({ categories, onSave, onClose }) {
  const [cats, setCats]         = useState(() => categories.map(c => ({ ...c })));
  const [newName, setNewName]   = useState('');
  const [newEmoji, setNewEmoji] = useState('💵');
  const [newType, setNewType]   = useState('want');

  function addCat() {
    if (!newName.trim()) return;
    setCats(prev => [...prev, { id: generateId(), name: newName.trim(), emoji: newEmoji, type: newType, allocated: 0 }]);
    setNewName(''); setNewEmoji('💵'); setNewType('want');
  }
  function updateCat(id, field, value) {
    setCats(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  }
  function deleteCat(id) {
    setCats(prev => prev.filter(c => c.id !== id));
  }
  function handleSave() {
    onSave(cats.filter(c => c.name.trim()));
    onClose();
  }

  return (
    <div className="shop-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="shop-dialog shop-dialog--lg">
        <div className="shop-dialog-header">
          <h4 className="shop-dialog-title">Budget Categories</h4>
          <button className="sic-act" onClick={onClose}><IconX /></button>
        </div>

        <div className="pantry-add-form">
          <input className="form-input scat-emoji-inp" value={newEmoji} maxLength={4}
            onChange={e => setNewEmoji(e.target.value)} title="Emoji" />
          <input className="form-input" style={{ flex: 1 }} placeholder="New category name…"
            value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCat()} />
          <select className="form-input" style={{ width: 110 }} value={newType} onChange={e => setNewType(e.target.value)}>
            <option value="need">Need</option>
            <option value="want">Want</option>
            <option value="saving">Saving</option>
          </select>
          <button className="btn-primary sm" disabled={!newName.trim()} onClick={addCat}><IconPlus /> Add</button>
        </div>

        <ul className="pantry-manage-list">
          {cats.map(cat => (
            <li key={cat.id} className="pantry-manage-item">
              <input className="form-input scat-emoji-inp" value={cat.emoji} maxLength={4}
                onChange={e => updateCat(cat.id, 'emoji', e.target.value)} />
              <input className="form-input" style={{ flex: 1 }} value={cat.name}
                onChange={e => updateCat(cat.id, 'name', e.target.value)} />
              <select className="form-input" style={{ width: 110 }} value={cat.type}
                onChange={e => updateCat(cat.id, 'type', e.target.value)}>
                <option value="need">Need</option>
                <option value="want">Want</option>
                <option value="saving">Saving</option>
              </select>
              <button className="sic-act sic-act--del" onClick={() => deleteCat(cat.id)}><IconTrash /></button>
            </li>
          ))}
        </ul>

        <div className="shop-dialog-actions">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

// ── LogExpenseModal ──────────────────────────────────────────────────────────────
function LogExpenseModal({ categories, recentPayees, onSave, onClose }) {
  const [quick, setQuick] = useState('');
  const [fields, setFields] = useState({
    amount: '', payee: '', categoryId: categories[0]?.id || 'other',
    date: getToday(), note: '',
  });

  function applyQuick() {
    const parsed = parseExpenseText(quick);
    if (!parsed) return;
    setFields(f => ({
      ...f, amount: parsed.amount, payee: parsed.payee,
      note: parsed.note || f.note, categoryId: categorizeExpense(quick),
    }));
    setQuick('');
  }

  function pickPayee(p) {
    setFields(f => ({ ...f, payee: p.payee, categoryId: p.categoryId || f.categoryId }));
  }

  function handleSave() {
    const amount = parseFloat(fields.amount);
    if (!amount || !fields.payee.trim()) return;
    onSave({ amount, payee: fields.payee.trim(), categoryId: fields.categoryId, date: fields.date, note: fields.note.trim() });
  }

  return (
    <div className="shop-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="shop-dialog shop-dialog--lg">
        <div className="shop-dialog-header">
          <h4 className="shop-dialog-title">Log Expense</h4>
          <button className="sic-act" onClick={onClose}><IconX /></button>
        </div>

        <div className="shop-dialog-body">
          <div className="shop-field">
            <label className="shop-field-label">Quick entry</label>
            <div className="scan-manual-row">
              <input className="form-input" placeholder='Try: "Spent $14.50 on lunch at Sweetgreen"'
                value={quick} onChange={e => setQuick(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), applyQuick())} />
              <button className="btn-ghost sm" onClick={applyQuick} disabled={!quick.trim()}>Parse</button>
            </div>
            <p className="shop-field-hint" style={{ color: 'var(--text-muted)' }}>
              Heuristic text parsing, not AI — fills in the fields below so you can double-check them.
            </p>
          </div>

          {recentPayees.length > 0 && (
            <div className="shop-field">
              <label className="shop-field-label">Recent & favorite payees</label>
              <div className="shop-pills shop-pills--wrap">
                {recentPayees.map(p => (
                  <button key={p.payee} className="shop-pill" onClick={() => pickPayee(p)}>{p.payee}</button>
                ))}
              </div>
            </div>
          )}

          <div className="shop-field-row">
            <div className="shop-field">
              <label className="shop-field-label">Amount ($)</label>
              <input className="form-input" type="number" min="0" step="0.01" placeholder="0.00"
                value={fields.amount} onChange={e => setFields(f => ({ ...f, amount: e.target.value }))} autoFocus />
            </div>
            <div className="shop-field">
              <label className="shop-field-label">Payee</label>
              <input className="form-input" placeholder="e.g. Sweetgreen"
                value={fields.payee} onChange={e => setFields(f => ({ ...f, payee: e.target.value }))} />
            </div>
            <div className="shop-field">
              <label className="shop-field-label">Date</label>
              <input className="form-input" type="date" value={fields.date}
                onChange={e => setFields(f => ({ ...f, date: e.target.value }))} />
            </div>
          </div>

          <div className="shop-field">
            <label className="shop-field-label">Category</label>
            <div className="shop-cat-select-wrap">
              <span className="shop-cat-preview">{categories.find(c => c.id === fields.categoryId)?.emoji}</span>
              <select className="form-input shop-cat-select" value={fields.categoryId}
                onChange={e => setFields(f => ({ ...f, categoryId: e.target.value }))}>
                {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="shop-field">
            <label className="shop-field-label">Note</label>
            <input className="form-input" placeholder="optional…" value={fields.note}
              onChange={e => setFields(f => ({ ...f, note: e.target.value }))} />
          </div>
        </div>

        <div className="shop-dialog-actions">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={!fields.amount || !fields.payee.trim()}>
            Log Expense
          </button>
        </div>
      </div>
    </div>
  );
}

// ── IncomeModal ───────────────────────────────────────────────────────────────
function IncomeModal({ income, onSave, onClose }) {
  const [fields, setFields] = useState({
    source: income?.source || '', amount: income?.amount ?? '', frequency: income?.frequency || 'monthly',
  });
  function handleSave() {
    const amount = parseFloat(fields.amount);
    if (!fields.source.trim() || !amount) return;
    onSave({ source: fields.source.trim(), amount, frequency: fields.frequency });
  }
  return (
    <div className="shop-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="shop-dialog">
        <div className="shop-dialog-header">
          <h4 className="shop-dialog-title">{income ? 'Edit Income' : 'Add Income'}</h4>
          <button className="sic-act" onClick={onClose}><IconX /></button>
        </div>
        <div className="shop-dialog-body">
          <div className="shop-field">
            <label className="shop-field-label">Source</label>
            <input className="form-input" placeholder="e.g. Paycheck, Freelance client" autoFocus
              value={fields.source} onChange={e => setFields(f => ({ ...f, source: e.target.value }))} />
          </div>
          <div className="shop-field-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="shop-field">
              <label className="shop-field-label">Amount ($)</label>
              <input className="form-input" type="number" min="0" step="0.01" placeholder="0.00"
                value={fields.amount} onChange={e => setFields(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div className="shop-field">
              <label className="shop-field-label">Frequency</label>
              <select className="form-input" value={fields.frequency}
                onChange={e => setFields(f => ({ ...f, frequency: e.target.value }))}>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>
        </div>
        <div className="shop-dialog-actions">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={!fields.source.trim() || !fields.amount}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ── BillModal ─────────────────────────────────────────────────────────────────
function BillModal({ bill, categories, onSave, onClose }) {
  const [fields, setFields] = useState({
    name: bill?.name || '', emoji: bill?.emoji || '📄', amount: bill?.amount ?? '',
    categoryId: bill?.categoryId || categories[0]?.id || 'other', dueDay: bill?.dueDay || 1,
  });

  function applyTemplate(tpl) {
    setFields(f => ({ ...f, name: tpl.name, emoji: tpl.emoji, categoryId: tpl.categoryId }));
  }
  function handleSave() {
    const amount = parseFloat(fields.amount);
    if (!fields.name.trim() || !amount) return;
    onSave({
      name: fields.name.trim(), emoji: fields.emoji, amount, categoryId: fields.categoryId,
      dueDay: Math.min(31, Math.max(1, parseInt(fields.dueDay) || 1)),
      paidThisCycle: bill?.paidThisCycle || false,
    });
  }

  return (
    <div className="shop-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="shop-dialog shop-dialog--lg">
        <div className="shop-dialog-header">
          <h4 className="shop-dialog-title">{bill ? 'Edit Bill' : 'Add Bill'}</h4>
          <button className="sic-act" onClick={onClose}><IconX /></button>
        </div>

        <div className="shop-dialog-body">
          {!bill && (
            <div className="shop-field">
              <label className="shop-field-label">Start from a template</label>
              <div className="budget-template-grid">
                {BILL_TEMPLATES.map(tpl => (
                  <button key={tpl.name} className="budget-template-btn" onClick={() => applyTemplate(tpl)}>
                    <span>{tpl.emoji}</span> {tpl.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="shop-field-row" style={{ gridTemplateColumns: '52px 1fr' }}>
            <div className="shop-field">
              <label className="shop-field-label">Icon</label>
              <input className="form-input scat-emoji-inp" value={fields.emoji} maxLength={4}
                onChange={e => setFields(f => ({ ...f, emoji: e.target.value }))} />
            </div>
            <div className="shop-field">
              <label className="shop-field-label">Bill name</label>
              <input className="form-input" placeholder="e.g. Rent" autoFocus
                value={fields.name} onChange={e => setFields(f => ({ ...f, name: e.target.value }))} />
            </div>
          </div>

          <div className="shop-field-row">
            <div className="shop-field">
              <label className="shop-field-label">Amount ($)</label>
              <input className="form-input" type="number" min="0" step="0.01" placeholder="0.00"
                value={fields.amount} onChange={e => setFields(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div className="shop-field">
              <label className="shop-field-label">Due day of month</label>
              <input className="form-input" type="number" min="1" max="31"
                value={fields.dueDay} onChange={e => setFields(f => ({ ...f, dueDay: e.target.value }))} />
            </div>
            <div className="shop-field">
              <label className="shop-field-label">Category</label>
              <select className="form-input" value={fields.categoryId}
                onChange={e => setFields(f => ({ ...f, categoryId: e.target.value }))}>
                {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="shop-dialog-actions">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={!fields.name.trim() || !fields.amount}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ── Main BudgetView ────────────────────────────────────────────────────────────
export default function BudgetView({ lists }) {
  // Persisted budget state now lives in Dexie; the setters keep the same
  // `setX(prev => next)` shape this component was already written against.
  const {
    categories, income, bills, expenses, settings,
    setCategories, setIncome, setBills, setExpenses, setSettings,
  } = useBudget();

  const [showLogExpense,  setShowLogExpense]  = useState(false);
  const [showCategories,  setShowCategories]  = useState(false);
  const [incomeModal,     setIncomeModal]     = useState(undefined); // undefined=closed, null=create, obj=edit
  const [billModal,       setBillModal]       = useState(undefined);
  const [editingCash,     setEditingCash]     = useState(false);
  const [cashDraft,       setCashDraft]       = useState(settings.cashOnHand);
  const [deleteTarget,    setDeleteTarget]    = useState(null); // { kind, id, label }

  // ── Derived numbers ───────────────────────────────────────────────────────
  const monthKey = getToday().slice(0, 7);

  const spentByCategory = useMemo(() => {
    const map = {};
    expenses.filter(e => e.date?.slice(0, 7) === monthKey)
      .forEach(e => { map[e.categoryId] = (map[e.categoryId] || 0) + e.amount; });
    return map;
  }, [expenses, monthKey]);

  const monthlyIncome = useMemo(() =>
    income.reduce((s, i) => s + i.amount * (FREQ_MONTHLY_MULT[i.frequency] || 1), 0),
  [income]);

  const totalAllocated = useMemo(() => categories.reduce((s, c) => s + (c.allocated || 0), 0), [categories]);
  const unallocated = monthlyIncome - totalAllocated;

  const unpaidBillsTotal = useMemo(() => bills.filter(b => !b.paidThisCycle).reduce((s, b) => s + b.amount, 0), [bills]);
  const savingsCommitted = useMemo(() =>
    categories.filter(c => c.type === 'saving').reduce((s, c) => s + (c.allocated || 0), 0),
  [categories]);
  const safeToSpend = (settings.cashOnHand || 0) - unpaidBillsTotal - savingsCommitted;

  const recentPayees = useMemo(() => getRecentPayees(expenses), [expenses]);

  const sortedBills = useMemo(() => [...bills].sort((a, b) => a.dueDay - b.dueDay), [bills]);
  const recentExpenses = useMemo(() =>
    [...expenses].sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt)).slice(0, 12),
  [expenses]);

  const shoppingListsTotal = useMemo(() =>
    lists.reduce((sum, l) => sum + l.items.filter(i => !i.checked && i.estimatedPrice != null)
      .reduce((s, i) => s + i.estimatedPrice, 0), 0),
  [lists]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const allocate = useCallback((catId, val) => {
    setCategories(prev => prev.map(c => c.id === catId ? { ...c, allocated: val } : c));
  }, [setCategories]);

  const logExpense = (data) => {
    setExpenses(prev => [{ id: generateId(), ...data, createdAt: new Date().toISOString() }, ...prev]);
    setShowLogExpense(false);
  };

  const saveIncome = (data) => {
    if (incomeModal?.id) setIncome(prev => prev.map(i => i.id === incomeModal.id ? { ...i, ...data } : i));
    else setIncome(prev => [...prev, { id: generateId(), ...data }]);
    setIncomeModal(undefined);
  };

  const saveBill = (data) => {
    if (billModal?.id) setBills(prev => prev.map(b => b.id === billModal.id ? { ...b, ...data } : b));
    else setBills(prev => [...prev, { id: generateId(), ...data }]);
    setBillModal(undefined);
  };

  const togglePaid = (id) => setBills(prev => prev.map(b => b.id === id ? { ...b, paidThisCycle: !b.paidThisCycle } : b));
  const resetBillCycle = () => setBills(prev => prev.map(b => ({ ...b, paidThisCycle: false })));

  const saveCash = () => {
    setSettings(s => ({ ...s, cashOnHand: parseFloat(cashDraft) || 0 }));
    setEditingCash(false);
  };

  function confirmDelete() {
    const { kind, id } = deleteTarget;
    if (kind === 'income')  setIncome(prev => prev.filter(i => i.id !== id));
    if (kind === 'bill')    setBills(prev => prev.filter(b => b.id !== id));
    if (kind === 'expense') setExpenses(prev => prev.filter(e => e.id !== id));
    setDeleteTarget(null);
  }

  const catMap = useMemo(() => Object.fromEntries(categories.map(c => [c.id, c])), [categories]);
  const methodology = settings.methodology;

  return (
    <div className="shop-center-content">
      <div className="shop-center-header recipe-mode-header">
        <div>
          <h2 className="shop-center-title">Monthly Budget</h2>
          <p className="recipe-mode-sub">Income, bills, and spending across your whole month — groceries included, but not the whole story.</p>
        </div>
        <div className="budget-header-actions">
          <div className="budget-methodology-switch" title={METHODOLOGIES.find(m => m.id === methodology)?.blurb}>
            {METHODOLOGIES.map(m => (
              <button key={m.id}
                className={`shop-list-chip ${methodology === m.id ? 'shop-list-chip--active' : ''}`}
                onClick={() => setSettings(s => ({ ...s, methodology: m.id }))}>
                {m.label}
              </button>
            ))}
          </div>
          <button className="btn-primary" onClick={() => setShowLogExpense(true)}><IconPlus /> Log Expense</button>
        </div>
      </div>

      <div className="shop-center-scroll">
        {/* Safe-to-Spend hero */}
        <div className="budget-hero-card">
          <div className="budget-hero-main">
            <span className="budget-hero-label"><IconWallet /> Safe to Spend</span>
            <span className={`budget-hero-amount ${safeToSpend < 0 ? 'budget-hero-amount--over' : ''}`}>
              ${safeToSpend.toFixed(2)}
            </span>
            {editingCash ? (
              <div className="budget-cash-edit-row">
                <span>$</span>
                <input className="form-input" type="number" min="0" step="10" autoFocus
                  value={cashDraft} onChange={e => setCashDraft(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveCash()} />
                <button className="btn-primary sm" onClick={saveCash}>Save</button>
                <button className="btn-ghost sm" onClick={() => setEditingCash(false)}>Cancel</button>
              </div>
            ) : (
              <button className="budget-cash-edit-btn" onClick={() => { setCashDraft(settings.cashOnHand); setEditingCash(true); }}>
                Cash on hand: ${(settings.cashOnHand || 0).toFixed(2)} <IconPencil />
              </button>
            )}
          </div>
          <div className="budget-hero-breakdown">
            <div className="budget-hero-row"><span>Cash on hand</span><span>${(settings.cashOnHand || 0).toFixed(2)}</span></div>
            <div className="budget-hero-row budget-hero-row--sub"><span>− Upcoming bills</span><span>${unpaidBillsTotal.toFixed(2)}</span></div>
            <div className="budget-hero-row budget-hero-row--sub"><span>− Savings goals</span><span>${savingsCommitted.toFixed(2)}</span></div>
          </div>
        </div>

        <div className="budget-bento">
          {/* ── Main column ── */}
          <div className="budget-main-col">
            {methodology === '50-30-20' && (
              <div className="budget-bucket-grid">
                {['need', 'want', 'saving'].map(type => {
                  const target = monthlyIncome * RULE_502030[type];
                  const actual = categories.filter(c => c.type === type)
                    .reduce((s, c) => s + (spentByCategory[c.id] || 0), 0);
                  const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;
                  return (
                    <div key={type} className="budget-bucket-card" style={{ '--tc': TYPE_COLOR[type] }}>
                      <div className="budget-bucket-head">
                        <span>{TYPE_LABEL[type]}</span>
                        <span className="budget-bucket-pct">{Math.round(RULE_502030[type] * 100)}%</span>
                      </div>
                      <div className="budget-bucket-amounts">${actual.toFixed(0)} <span>/ ${target.toFixed(0)}</span></div>
                      <div className="budget-bucket-bar-track">
                        <div className="budget-bucket-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {methodology === 'zero-based' && (
              <div className="budget-card">
                <div className="budget-zb-summary">
                  <div className="budget-zb-stat"><span>Monthly Income</span><strong>${monthlyIncome.toFixed(2)}</strong></div>
                  <div className="budget-zb-stat"><span>Allocated</span><strong>${totalAllocated.toFixed(2)}</strong></div>
                  <div className={`budget-zb-stat ${unallocated < 0 ? 'budget-zb-stat--over' : unallocated === 0 ? 'budget-zb-stat--zero' : ''}`}>
                    <span>Unallocated</span><strong>${unallocated.toFixed(2)}</strong>
                  </div>
                </div>
              </div>
            )}

            <div className="budget-card">
              <div className="budget-card-header">
                <h3 className="budget-card-title">{methodology === 'envelope' ? 'Envelopes' : 'Categories'}</h3>
                <button className="btn-ghost sm" onClick={() => setShowCategories(true)}><IconPencil /> Manage</button>
              </div>
              <div className="budget-envelope-grid">
                {categories.map(cat => (
                  <CategoryEnvelopeCard key={cat.id} cat={cat} spent={spentByCategory[cat.id] || 0} onAllocate={allocate} />
                ))}
              </div>
            </div>

            <div className="budget-card">
              <h3 className="budget-card-title">Recent Expenses</h3>
              {recentExpenses.length === 0 ? (
                <div className="empty-state" style={{ padding: '26px 10px' }}>
                  <span style={{ fontSize: 32 }}>🧾</span>
                  <p className="empty-title" style={{ fontSize: 13 }}>No expenses logged yet</p>
                  <p className="empty-sub">Log Expense to start tracking your spending</p>
                </div>
              ) : (
                <div className="budget-expenses-list">
                  {recentExpenses.map(e => {
                    const cat = catMap[e.categoryId];
                    return (
                      <div key={e.id} className="budget-expense-row">
                        <span className="budget-expense-icon">{cat?.emoji || '💵'}</span>
                        <div className="budget-expense-info">
                          <span className="budget-expense-name">{e.payee}</span>
                          <span className="budget-expense-meta">{cat?.name || 'Other'} · {e.date}</span>
                        </div>
                        <span className="budget-expense-amount">${e.amount.toFixed(2)}</span>
                        <button className="sic-act sic-act--del"
                          onClick={() => setDeleteTarget({ kind: 'expense', id: e.id, label: e.payee })}>
                          <IconTrash />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Side column ── */}
          <div className="budget-side-col">
            <div className="budget-card">
              <div className="budget-card-header">
                <h3 className="budget-card-title"><IconIncome /> Income</h3>
                <span className="pantry-badge">${monthlyIncome.toFixed(0)}/mo</span>
              </div>
              {income.length === 0 ? (
                <p className="shop-right-empty">No income sources yet.</p>
              ) : (
                <div className="budget-list">
                  {income.map(i => (
                    <div key={i.id} className="budget-list-row">
                      <div>
                        <span className="budget-list-name">{i.source}</span>
                        <span className="budget-list-sub">{i.frequency}</span>
                      </div>
                      <span className="budget-list-amt">${i.amount.toFixed(2)}</span>
                      <button className="scat-edit-btn" onClick={() => setIncomeModal(i)}><IconPencil /></button>
                      <button className="sic-act sic-act--del" onClick={() => setDeleteTarget({ kind: 'income', id: i.id, label: i.source })}><IconTrash /></button>
                    </div>
                  ))}
                </div>
              )}
              <button className="btn-ghost sm" style={{ width: '100%', marginTop: 8 }} onClick={() => setIncomeModal(null)}>
                <IconPlus /> Add Income
              </button>
            </div>

            <div className="budget-card">
              <div className="budget-card-header">
                <h3 className="budget-card-title"><IconBill /> Bills</h3>
                <span className={`pantry-badge ${unpaidBillsTotal > 0 ? '' : 'pantry-badge--done'}`}>${unpaidBillsTotal.toFixed(0)} due</span>
              </div>
              {sortedBills.length === 0 ? (
                <p className="shop-right-empty">No recurring bills yet.</p>
              ) : (
                <div className="budget-list">
                  {sortedBills.map(b => (
                    <div key={b.id} className={`budget-list-row ${b.paidThisCycle ? 'budget-list-row--paid' : ''}`}>
                      <button className="budget-bill-check" onClick={() => togglePaid(b.id)} title="Mark paid this cycle">
                        {b.paidThisCycle && <IconCheck />}
                      </button>
                      <div>
                        <span className="budget-list-name">{b.emoji} {b.name}</span>
                        <span className="budget-list-sub">Due day {b.dueDay}</span>
                      </div>
                      <span className="budget-list-amt">${b.amount.toFixed(2)}</span>
                      <button className="scat-edit-btn" onClick={() => setBillModal(b)}><IconPencil /></button>
                      <button className="sic-act sic-act--del" onClick={() => setDeleteTarget({ kind: 'bill', id: b.id, label: b.name })}><IconTrash /></button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn-ghost sm" style={{ flex: 1 }} onClick={() => setBillModal(null)}><IconPlus /> Add Bill</button>
                {bills.some(b => b.paidThisCycle) && (
                  <button className="btn-ghost sm" onClick={resetBillCycle} title="Start a new billing cycle">Reset</button>
                )}
              </div>
            </div>

            {recentPayees.length > 0 && (
              <div className="budget-card">
                <h3 className="budget-card-title">Recent &amp; Favorite Payees</h3>
                <div className="shop-pills shop-pills--wrap">
                  {recentPayees.map(p => (
                    <span key={p.payee} className="shop-pill" style={{ cursor: 'default' }}>{p.payee}</span>
                  ))}
                </div>
              </div>
            )}

            {lists.length > 0 && (
              <div className="budget-card">
                <h3 className="budget-card-title"><IconCart /> Shopping Lists</h3>
                {lists.map(l => {
                  const est = l.items.filter(i => !i.checked && i.estimatedPrice != null).reduce((s, i) => s + i.estimatedPrice, 0);
                  return (
                    <div key={l.id} className="shop-budget-list-row">
                      <span className="shop-budget-list-name">🛒 {l.name}</span>
                      <span className="shop-budget-list-count">{l.items.length} items</span>
                      <span className="shop-budget-list-amt">{est > 0 ? `$${est.toFixed(2)}` : '—'}</span>
                    </div>
                  );
                })}
                <p className="shop-field-hint" style={{ marginTop: 6 }}>
                  ${shoppingListsTotal.toFixed(2)} in estimated grocery costs across all lists — log a purchase above once it's actually spent.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showLogExpense && (
        <LogExpenseModal categories={categories} recentPayees={recentPayees} onSave={logExpense} onClose={() => setShowLogExpense(false)} />
      )}
      {showCategories && (
        <ManageBudgetCategoriesModal categories={categories} onSave={setCategories} onClose={() => setShowCategories(false)} />
      )}
      {incomeModal !== undefined && (
        <IncomeModal income={incomeModal} onSave={saveIncome} onClose={() => setIncomeModal(undefined)} />
      )}
      {billModal !== undefined && (
        <BillModal bill={billModal} categories={categories} onSave={saveBill} onClose={() => setBillModal(undefined)} />
      )}
      {deleteTarget && (
        <ConfirmModal
          title={`Delete "${deleteTarget.label}"?`}
          message="This can't be undone."
          onConfirm={confirmDelete}
          onClose={() => setDeleteTarget(null)} />
      )}
    </div>
  );
}
