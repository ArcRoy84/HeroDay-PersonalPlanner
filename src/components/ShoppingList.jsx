import React, { useState, useCallback, useMemo, useRef } from 'react';
import { useShoppingPrefs } from '../hooks/useShoppingPrefs';
import { categorize } from '../data/shoppingCategories.js';
import ShoppingStoreMode from './ShoppingStoreMode.jsx';
import BudgetView from './BudgetView.jsx';
import {
  IconMic, IconPlus, IconCart, IconShare, IconSparkle,
  IconCalendar, IconNavigation, IconBarcode, NAV,
} from './shopping/icons.jsx';
import { parseItems, getSuggestions, daysSince } from './shopping/parsing.js';
import { useVoice } from './shopping/useVoice.js';
import { CategorySection } from './shopping/items.jsx';
import { EditItemModal } from './shopping/EditItemModal.jsx';
import { ScanItemModal } from './shopping/ScanItemModal.jsx';
import {
  DeleteConfirmModal, AddToPlannerModal, NewListDialog,
} from './shopping/dialogs.jsx';
import { ManageCategoriesModal, ManageUnitsModal } from './shopping/managers.jsx';
import { RecipesView } from './shopping/recipes.jsx';
import { AllItemsView, StoresView } from './shopping/views.jsx';

export default function ShoppingList({
  lists, history, recipes, setRecipes, onAddToPlanner,
  // Item-level writes, one scoped call per user action — see db/shoppingOps.ts.
  addItemToList: addItemRow,
  updateItem: updateItemRow,
  removeItem: removeItemRow,
  toggleItem: toggleItemRow,
  clearChecked: clearCheckedRow,
  createList: createListRow,
  removeList: removeListRow,
}) {
  const [activeSection,  setActiveSection]  = useState('lists');
  const [activeId,       setActiveId]       = useState(() => lists[0]?.id || null);
  const [inputText,      setInputText]      = useState('');
  const [storeMode,      setStoreMode]      = useState(false);
  const [editingItem,    setEditingItem]    = useState(null);
  const [deletingItem,   setDeletingItem]   = useState(null);
  const [scanDraft,      setScanDraft]      = useState(null);
  const [showScan,       setShowScan]       = useState(false);
  const [showNewList,    setShowNewList]    = useState(false);
  const [showPlanner,    setShowPlanner]    = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [showUnits,      setShowUnits]      = useState(false);
  const [copyMsg,        setCopyMsg]        = useState(false);
  const [voiceError,     setVoiceError]     = useState('');
  // Store categories, the pantry tracker and the unit list are persisted in
  // Dexie; the setters keep the shapes this component already calls them with.
  const {
    categories, setCategories: updateCategories,
    pantryItems, setPantryItems,
    units, setUnits: updateUnits,
  } = useShoppingPrefs();
  const inputRef = useRef(null);

  const catMap = useMemo(
    () => Object.fromEntries(categories.map(c => [c.id, c])),
    [categories]
  );

  // Barcodes are recorded on purchase-history entries (see toggleItem below),
  // so previously-purchased products are recognized on future scans.
  const barcodeMap = useMemo(
    () => Object.fromEntries(history.filter(h => h.barcode).map(h => [h.barcode, h])),
    [history]
  );

  const activeList = lists.find(l => l.id === activeId) || lists[0];

  // ── Voice ─────────────────────────────────────────────────────────────────
  const handleVoiceResult = useCallback((transcript) => {
    parseItems(transcript).forEach(p => addItem(p));  
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVoiceError = useCallback((msg) => {
    setVoiceError(msg);
    setTimeout(() => setVoiceError(''), 5000);
  }, []);

  const { listening, interim, start: startVoice, stop: stopVoice, supported: voiceOk } = useVoice(handleVoiceResult, handleVoiceError);

  // ── List / item CRUD ──────────────────────────────────────────────────────
  // Every action below is a single scoped write against the shopping tables.
  // Deduplication, purchase history and the pantry restock all happen inside
  // those operations, atomically, rather than being stitched together here.

  // Adds a parsed item to an arbitrary list by id (not necessarily the active
  // one), optionally overriding its category/note — used by the recipe
  // "Add to List" flow so ingredients can be routed to a chosen list and
  // tagged with their source.
  const addItemToList = useCallback((listId, parsed, overrides = {}) => {
    if (!parsed?.name?.trim() || !listId) return;
    const name = parsed.name.trim();
    addItemRow(listId, {
      name: name.charAt(0).toUpperCase() + name.slice(1),
      qty: parsed.qty,
      unit: parsed.unit,
      category: overrides.category || categorize(name),
      note: overrides.note || '',
      barcode: overrides.barcode || '',
    });
  }, [addItemRow]);

  // Creates a fully-specified item (used by the barcode scan flow, where every
  // field is already known — either from a matched product or a manual entry —
  // rather than parsed from free text).
  const createItemInList = useCallback((listId, fields) => {
    if (!fields?.name?.trim() || !listId) return;
    const name = fields.name.trim();
    addItemRow(listId, {
      ...fields,
      name,
      category: fields.category || categorize(name),
    });
  }, [addItemRow]);

  const addItem = useCallback((parsed) => {
    if (!activeList) return;
    addItemToList(activeList.id, parsed);
  }, [activeList, addItemToList]);

  // ── Barcode scanning ─────────────────────────────────────────────────────
  const addKnownProduct = useCallback((product) => {
    if (!activeList) return;
    createItemInList(activeList.id, {
      name: product.name, qty: 1, unit: product.unit || '',
      category: product.category || categorize(product.name),
      estimatedPrice: product.estimatedPrice ?? null,
      barcode: product.barcode,
    });
  }, [activeList, createItemInList]);

  // Returns { found } so the scan modal knows whether to keep scanning or hand
  // off to the "unknown code" flow (which it does by closing itself — see
  // ScanItemModal — once scanDraft is populated below).
  const handleScannedCode = useCallback((code) => {
    const product = barcodeMap[code];
    if (product) {
      addKnownProduct({ ...product, barcode: code });
      return { found: true, name: product.name };
    }
    setScanDraft({
      id: null, name: '', category: categories[0]?.id || 'other', qty: 1, unit: '',
      storeLocation: '', note: '', estimatedPrice: null, barcode: code,
    });
    return { found: false };
  }, [barcodeMap, addKnownProduct, categories]);

  const handleAdd = () => {
    if (!inputText.trim()) return;
    parseItems(inputText).forEach(p => addItem(p));
    setInputText('');
    inputRef.current?.focus();
  };

  // Ticking an item off also records the purchase and restocks the pantry.
  // Those used to be three separate setState calls stitched together here,
  // which needed care to avoid updating one component while rendering another;
  // they are now one transaction inside the operation.
  const toggleItem = useCallback((itemId) => {
    toggleItemRow(itemId);
  }, [toggleItemRow]);

  const updateItem = useCallback((itemId, updates) => {
    updateItemRow(itemId, updates);
  }, [updateItemRow]);

  const deleteItem = useCallback((item) => {
    removeItemRow(item.id);
    setDeletingItem(null);
  }, [removeItemRow]);

  const clearChecked = () => {
    if (!activeList) return;
    clearCheckedRow(activeList.id);
  };

  const createList = async (name) => {
    const id = await createListRow(name);
    setActiveId(id);
    setActiveSection('lists');
  };

  const deleteList = () => {
    if (lists.length <= 1 || !activeList) return;
    const fallback = lists.find(l => l.id !== activeList.id)?.id || null;
    removeListRow(activeList.id);
    setActiveId(fallback);
  };

  const shareList = () => {
    if (!activeList) return;
    const lines = [`🛒 ${activeList.name}\n`];
    const grouped = {};
    activeList.items.filter(i => !i.checked).forEach(i => {
      if (!grouped[i.category]) grouped[i.category] = [];
      grouped[i.category].push(i);
    });
    categories.filter(c => grouped[c.id]).forEach(cat => {
      lines.push(`\n${cat.emoji} ${cat.label}`);
      grouped[cat.id].forEach(item => {
        const q = (item.qty !== 1 || item.unit) ? `${item.qty}${item.unit ? ' ' + item.unit : ''} ` : '';
        lines.push(`□ ${q}${item.name}${item.note ? ` (${item.note})` : ''}`);
      });
    });
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopyMsg(true);
      setTimeout(() => setCopyMsg(false), 2000);
    });
  };

  const handleAddToPlanner = ({ date, time }) => {
    if (!activeList || !onAddToPlanner) return;
    onAddToPlanner({
      title:      `Go shopping · ${activeList.name}`,
      priority:   'medium',
      categoryId: 'personal',
      date,
      startTime:  time,
      duration:   60,
      tags:       ['shopping'],
      reminder:   false,
      description: `${activeList.items.filter(i => !i.checked).length} items remaining`,
    });
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    if (!activeList) return [];
    const map = {};
    activeList.items.forEach(i => { if (!map[i.category]) map[i.category] = []; map[i.category].push(i); });
    return categories.filter(c => map[c.id]).map(c => ({ cat: c, items: map[c.id] }));
  }, [activeList?.items]); // eslint-disable-line react-hooks/exhaustive-deps

  const uncheckedCount = activeList?.items.filter(i => !i.checked).length ?? 0;
  const checkedCount   = activeList?.items.filter(i =>  i.checked).length ?? 0;
  const totalCount     = activeList?.items.length ?? 0;
  const pct            = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;
  const estimatedTotal = activeList?.items
    .filter(i => !i.checked && i.estimatedPrice != null)
    .reduce((s, i) => s + i.estimatedPrice, 0) ?? 0;

  const suggestions = useMemo(() =>
    getSuggestions(history, activeList?.items || []),
  [history, activeList?.items]);  

  // ── Lists center panel ─────────────────────────────────────────────────────
  const ListsCenterPanel = () => (
    <div className="shop-center-content">
      {/* List selector tabs */}
      <div className="shop-list-tabs-bar">
        <div className="shop-list-tabs">
          {lists.map(l => (
            <button key={l.id}
              className={`shop-list-chip ${activeList?.id === l.id ? 'shop-list-chip--active' : ''}`}
              onClick={() => setActiveId(l.id)}>
              {l.name}
            </button>
          ))}
        </div>
        <button className="shop-store-mode-btn" onClick={() => setStoreMode(true)}>
          <IconNavigation /><span>Store Mode</span>
        </button>
      </div>
      <div className="shop-list-secondary-actions">
        <button className="btn-ghost sm" onClick={() => setShowScan(true)} disabled={!activeList}>
          <IconBarcode /> Scan Item
        </button>
        <button className="btn-ghost sm" onClick={() => setShowCategories(true)}>Categories</button>
        <button className="btn-ghost sm" onClick={() => setShowUnits(true)}>Units</button>
        {activeList && lists.length > 1 && (
          <button className="btn-ghost sm shop-del-list" onClick={deleteList}>Delete list</button>
        )}
      </div>

      {/* Search / add bar */}
      <div className="shop-search-bar">
        <span className="shop-search-icon"><IconCart /></span>
        <input
          ref={inputRef}
          className="shop-search-input"
          placeholder={listening
            ? (interim || 'Listening… try "2 lbs chicken and a dozen eggs"')
            : 'Add 2 lbs beef + eggs, milk… or speak items'}
          value={listening ? interim : inputText}
          onChange={e => !listening && setInputText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !listening && handleAdd()}
          readOnly={listening}
        />
        <button
          className={`shop-mic-btn${listening ? ' shop-mic-btn--on' : ''}`}
          onClick={listening ? stopVoice : startVoice}
          disabled={!voiceOk}
          title={voiceOk ? (listening ? 'Stop' : 'Voice input') : 'Voice not supported'}>
          <IconMic />
          {listening && <span className="mic-ring" />}
        </button>
        <button className="shop-search-add" onClick={handleAdd} disabled={!inputText.trim() || listening}>
          <IconPlus />
        </button>
      </div>
      {voiceError && <p className="shop-voice-error">{voiceError}</p>}

      {/* Progress bar */}
      <div className="shop-progress-track">
        <div className="shop-progress-fill" style={{ width: `${pct}%` }} />
      </div>

      {/* List header */}
      {activeList && (
        <div className="shop-list-hdr">
          <div className="shop-list-hdr-left">
            <h2 className="shop-list-hdr-title">{activeList.name}</h2>
            <span className="shop-list-hdr-meta">
              {uncheckedCount} of {totalCount} items · {pct}% done
              {estimatedTotal > 0 && ` · ~$${estimatedTotal.toFixed(2)} left`}
            </span>
          </div>
          <div className="shop-list-hdr-actions">
            {checkedCount > 0 && (
              <button className="btn-ghost sm" onClick={clearChecked}>Clear checked</button>
            )}
            <button className="btn-ghost sm" onClick={shareList}>
              <IconShare /> {copyMsg ? 'Copied!' : 'Share'}
            </button>
          </div>
        </div>
      )}

      {/* Suggestions strip */}
      {suggestions.length > 0 && (
        <div className="shop-pills">
          <span className="shop-pills-label">Add again</span>
          {suggestions.map(s => {
            const sc = catMap[s.category];
            return (
              <button key={s.name} className="shop-pill"
                onClick={() => addItem({ qty: 1, unit: s.unit || '', name: s.name })}>
                {sc?.emoji} {s.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Items scroll */}
      <div className="shop-center-scroll">
        {!activeList || grouped.length === 0 ? (
          <div className="empty-state">
            <span style={{ fontSize: 44 }}>🛒</span>
            <p className="empty-title">Your list is empty</p>
            <p className="empty-sub">Type above, use voice, or add from suggestions</p>
          </div>
        ) : (
          grouped.map(({ cat, items }) => (
            <CategorySection key={cat.id} cat={cat} items={items}
              onToggle={toggleItem}
              onUpdate={updateItem}
              onEdit={item => setEditingItem(item)}
              onDelete={item => setDeletingItem(item)} />
          ))
        )}
      </div>
    </div>
  );

  return (
    <>
    <div className={`shop-shell${storeMode ? ' shop-shell--store' : ''}`}>
      {/* ── LEFT PANEL ────────────────────────────────────────────────────── */}
      <div className="shop-left">
        <div className="shop-left-header">
          <span className="shop-left-title">Smart Shopping</span>
        </div>

        {/* Nav */}
        <nav className="shop-nav">
          {NAV.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`shop-nav-item ${activeSection === id ? 'shop-nav-item--active' : ''}`}
              onClick={() => setActiveSection(id)}>
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {/* FAB */}
        <button className="shop-fab" onClick={() => setShowNewList(true)}>
          <IconPlus />
          <span>New Shopping List</span>
        </button>
      </div>

      {/* ── CENTER PANEL ──────────────────────────────────────────────────── */}
      <div className="shop-center">
        {activeSection === 'lists' && storeMode && activeList
          ? <ShoppingStoreMode list={activeList} onToggle={toggleItem} onClose={() => setStoreMode(false)} categories={categories} />
          : activeSection === 'lists' && ListsCenterPanel()
        }
        {activeSection === 'recipes' && (
          <RecipesView
            recipes={recipes}
            onSaveRecipe={setRecipes}
            onDeleteRecipe={id => setRecipes(r => r.filter(x => x.id !== id))}
            onAddIngredients={(items, targetListId, recipeName) => {
              items.forEach(i => addItemToList(targetListId, i, {
                category: 'recipes',
                note: `Recipes - ${recipeName}`,
              }));
              setActiveId(targetListId);
              setActiveSection('lists');
            }}
            lists={lists}
            activeListId={activeList?.id}
            pantryItems={pantryItems}
            onSavePantry={setPantryItems}
            units={units} />
        )}
        {activeSection === 'budget' && (
          <BudgetView lists={lists} />
        )}
        {activeSection === 'items'  && <AllItemsView lists={lists} catMap={catMap} categories={categories} />}
        {activeSection === 'stores' && <StoresView lists={lists} />}
      </div>

      {/* ── RIGHT PANEL ───────────────────────────────────────────────────── */}
      <div className="shop-right">
        {/* Smart Suggestions */}
        <div className="shop-right-section">
          <h3 className="shop-right-title"><IconSparkle /> Smart Suggestions</h3>
          {suggestions.length === 0 ? (
            <p className="shop-right-empty">No suggestions yet. Check off items to build history.</p>
          ) : (
            <div className="shop-sugg-list">
              {suggestions.map(s => {
                const cat = catMap[s.category];
                return (
                  <div key={s.name} className="shop-sugg-tile" style={{ '--cc': cat?.color }}>
                    <div className="shop-sugg-icon">{cat?.emoji || '🛒'}</div>
                    <div className="shop-sugg-info">
                      <span className="shop-sugg-name">{s.name}</span>
                      <span className="shop-sugg-meta">
                        {s.count > 1 ? `Bought ${s.count}×` : 'Bought once'} · {daysSince(s.lastBought)}d ago
                      </span>
                    </div>
                    <button className="shop-sugg-add"
                      onClick={() => addItem({ qty: 1, unit: s.unit || '', name: s.name })}>
                      <IconPlus />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Re-Add */}
        {history.length > 0 && (
          <div className="shop-right-section">
            <h3 className="shop-right-title-sm">QUICK RE-ADD</h3>
            <div className="shop-pills shop-pills--wrap">
              {history.slice(0, 10).map(h => (
                <button key={h.name} className="shop-pill"
                  onClick={() => addItem({ qty: 1, unit: h.unit || '', name: h.name })}>
                  {catMap[h.category]?.emoji} {h.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recipe of the Week */}
        {recipes.length > 0 && (
          <div className="shop-right-section">
            <div className="shop-recipe-week-card">
              <div className="shop-recipe-week-bg">
                <span className="shop-recipe-week-emoji">🍽️</span>
              </div>
              <div className="shop-recipe-week-body">
                <span className="shop-recipe-week-label">RECIPE OF THE WEEK</span>
                <h4 className="shop-recipe-week-name">{recipes[0].name}</h4>
                <button className="shop-recipe-week-btn"
                  onClick={() => {
                    if (!activeList) return;
                    recipes[0].ingredients.forEach(i => addItemToList(activeList.id, i, {
                      category: 'recipes',
                      note: `Recipes - ${recipes[0].name}`,
                    }));
                    setActiveSection('lists');
                  }}>
                  Add {recipes[0].ingredients.length} ingredient{recipes[0].ingredients.length !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add to Planner */}
        {activeList && (
          <div className="shop-right-section">
            <button className="shop-planner-btn" onClick={() => setShowPlanner(true)}>
              <IconCalendar />
              <div>
                <div className="shop-planner-btn-title">Add to Planner</div>
                <div className="shop-planner-btn-sub">Schedule "Go shopping · {activeList.name}"</div>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {(editingItem || scanDraft) && (
        <EditItemModal
          item={editingItem || scanDraft}
          isNew={!editingItem}
          categories={categories}
          units={units}
          onSave={updates => {
            if (editingItem) updateItem(editingItem.id, updates);
            else createItemInList(activeList?.id, updates);
            setEditingItem(null);
            setScanDraft(null);
          }}
          onClose={() => { setEditingItem(null); setScanDraft(null); }} />
      )}

      {showScan && (
        <ScanItemModal
          onCode={handleScannedCode}
          onClose={() => setShowScan(false)} />
      )}

      {deletingItem && (
        <DeleteConfirmModal
          item={deletingItem}
          onConfirm={() => deleteItem(deletingItem)}
          onClose={() => setDeletingItem(null)} />
      )}

      {showNewList && (
        <NewListDialog onCreate={createList} onClose={() => setShowNewList(false)} />
      )}

      {showPlanner && (
        <AddToPlannerModal
          listName={activeList?.name || ''}
          onAdd={handleAddToPlanner}
          onClose={() => setShowPlanner(false)} />
      )}

      {showCategories && (
        <ManageCategoriesModal
          categories={categories}
          onSave={updateCategories}
          onClose={() => setShowCategories(false)} />
      )}

      {showUnits && (
        <ManageUnitsModal
          units={units}
          onSave={updateUnits}
          onClose={() => setShowUnits(false)} />
      )}
    </div>

    {/* ── Mobile bottom navigation ─────────────────────────────────────── */}
    {!storeMode && (
      <nav className="shop-bottom-nav">
        {NAV.map(({ id, label, Icon }) => (
          <button key={id}
            className={`shop-bnav-item ${activeSection === id ? 'shop-bnav-item--active' : ''}`}
            onClick={() => setActiveSection(id)}>
            <Icon />
            <span className="shop-bnav-label">{label}</span>
          </button>
        ))}
        <button className="shop-bnav-item shop-bnav-new" onClick={() => setShowNewList(true)}>
          <IconPlus />
          <span className="shop-bnav-label">New</span>
        </button>
      </nav>
    )}
    </>
  );
}
