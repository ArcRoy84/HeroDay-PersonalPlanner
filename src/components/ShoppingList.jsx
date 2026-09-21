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
  DeleteConfirmModal, ConfirmModal, AddToPlannerModal, NewListDialog,
} from './shopping/dialogs.jsx';
import { ManageCategoriesModal, ManageUnitsModal } from './shopping/managers.jsx';
import { RecipesView } from './shopping/recipes.jsx';
import { ItemsView } from './shopping/ItemsView.jsx';
import { StoresView, StoreIcon } from './shopping/stores.jsx';
import { StoreFormModal } from './shopping/StoreFormModal.jsx';
import { OTHER_STORE_CATEGORY_ID } from '../data/storeCategories.js';
import { computeInsights } from '../analytics/insights';
import { lookupProduct } from './shopping/lookup.js';
import { loadSampleData, removeSampleData } from '../demo/sampleData';
import { describeVariant } from '../db/productOps';
import { toLocalDate, parseDateOnly } from '../utils/products';

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
  // Stores — see db/storeOps.ts.
  stores, storeCategories,
  createStore, updateStore, removeStore,
  saveStoreCategories, linkListToStore, createListForStore,
  // The product catalog and purchase log — see db/productOps.ts, db/purchaseOps.ts.
  products, purchases,
  createProduct, updateProduct, removeProduct, addProductToList,
  logPastPurchase, confirmPurchase, updatePurchase, removePurchase,
}) {
  const [activeSection,  setActiveSection]  = useState('lists');
  const [activeId,       setActiveId]       = useState(() => lists[0]?.id || null);
  const [inputText,      setInputText]      = useState('');
  const [storeMode,      setStoreMode]      = useState(false);
  const [editingItem,    setEditingItem]    = useState(null);
  const [deletingItem,   setDeletingItem]   = useState(null);
  const [scanDraft,      setScanDraft]      = useState(null);
  // The Open Food Facts answer for the barcode being added: { status, code, prefill, message }.
  const [scanLookup,     setScanLookup]     = useState({ status: 'idle', code: null, prefill: null, message: '' });
  const [showScan,       setShowScan]       = useState(false);
  const [showNewList,    setShowNewList]    = useState(false);
  const [showPlanner,    setShowPlanner]    = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [showUnits,      setShowUnits]      = useState(false);
  // Store form: undefined = closed, null = adding, a store = editing it.
  const [storeForm,      setStoreForm]      = useState(undefined);
  const [showStoreCats,  setShowStoreCats]  = useState(false);
  const [deletingStore,  setDeletingStore]  = useState(null);
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

  // ── Items: analytics and the inline price editor ─────────────────────────
  // What is waiting, unticked, on some list right now — restock nudges skip these.
  const onListProductIds = useMemo(
    () => new Set(lists.flatMap(l => l.items).filter(i => !i.checked && i.productId).map(i => i.productId)),
    [lists],
  );

  // A ticked item's purchase, so its card can ask "what did you pay?".
  const purchaseByItem = useMemo(
    () => new Map(purchases.filter(p => p.itemId).map(p => [p.itemId, p])),
    [purchases],
  );

  // Only worked out while the Items section is open. It is given today's date as
  // "now", so it is recomputed when the day changes and "3 days ago" cannot go
  // stale in an app left open past midnight.
  const today = toLocalDate();
  const insights = useMemo(
    () => (activeSection === 'items'
      ? computeInsights({
        products, purchases, pantry: pantryItems, onListProductIds, now: parseDateOnly(today),
      })
      : null),
    [activeSection, products, purchases, pantryItems, onListProductIds, today],
  );

  // The removable sample data: what the Items section offers to load and remove.
  const [sampleBusy, setSampleBusy] = useState(false);
  const sample = useMemo(() => {
    const run = (work) => async () => {
      setSampleBusy(true);
      try { await work(); } catch (failure) { console.error(failure); } finally { setSampleBusy(false); }
    };
    return {
      hasSample: products.some(p => p.demo === true),
      busy: sampleBusy,
      load: run(() => loadSampleData()),
      remove: run(() => removeSampleData()),
    };
  }, [products, sampleBusy]);

  const catalogActions = useMemo(() => ({
    createProduct, updateProduct, removeProduct, addProductToList,
    logPastPurchase, confirmPurchase, updatePurchase, removePurchase,
  }), [createProduct, updateProduct, removeProduct, addProductToList,
    logPastPurchase, confirmPurchase, updatePurchase, removePurchase]);

  const storeMap = useMemo(
    () => Object.fromEntries(stores.map(s => [s.id, s])),
    [stores],
  );

  // A scanned code is matched against the product catalog. It learns barcodes as
  // items are added and bought, and knows the exact product (brand and size
  // included), which the old name-keyed purchase history could not.
  const productByBarcode = useMemo(
    () => Object.fromEntries(products.filter(p => p.barcode).map(p => [p.barcode, p])),
    [products],
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
      name: product.name, qty: 1, unit: '',
      category: product.category || categorize(product.name),
      barcode: product.barcode,
      // The exact product, so a second brand of "Milk" is not mistaken for this one.
      productId: product.id,
      note: describeVariant(product),
    });
  }, [activeList, createItemInList]);

  // Returns { found } so the scan modal knows whether to keep scanning or hand
  // off to the "unknown code" flow (which it does by closing itself — see
  // ScanItemModal — once scanDraft is populated below).
  const handleScannedCode = useCallback((code) => {
    const product = productByBarcode[code];
    if (product) {
      addKnownProduct({ ...product, barcode: code });
      return { found: true, name: product.name };
    }
    setScanDraft({
      id: null, name: '', category: categories[0]?.id || 'other', qty: 1, unit: '',
      storeLocation: '', note: '', estimatedPrice: null, barcode: code,
    });

    // An unknown code is looked up on Open Food Facts, sending only the number.
    // The form is already showing, so a slow or failed lookup never holds up
    // adding the item by hand; an answer for a code that is no longer the one on
    // screen is ignored.
    setScanLookup({ status: 'loading', code, prefill: null, message: '' });
    lookupProduct(code).then(
      found => setScanLookup(current => (current.code !== code ? current : found
        ? { status: 'done', code, prefill: found, message: '' }
        : { status: 'empty', code, prefill: null, message: '' })),
      failure => setScanLookup(current => (current.code !== code ? current : {
        status: 'error', code, prefill: null,
        message: failure instanceof Error && failure.message
          ? failure.message
          : 'Barcode lookup failed. Fill in the details by hand.',
      })),
    );
    return { found: false };
  }, [productByBarcode, addKnownProduct, categories]);

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

  const openList = (listId) => {
    setActiveId(listId);
    setActiveSection('lists');
  };

  // Creating with "also make a list" selects that list, so the store the user
  // just added is immediately the one they are looking at.
  const handleSaveStore = async (input, { createList: withList }) => {
    if (storeForm) {
      await updateStore(storeForm.id, input);
    } else {
      const { listId } = await createStore(input, { createList: withList });
      if (listId) setActiveId(listId);
    }
    setStoreForm(undefined);
  };

  const handleAddListForStore = async (store) => {
    const listId = await createListForStore(store.id);
    if (listId) openList(listId);
  };

  const confirmDeleteStore = async () => {
    const store = deletingStore;
    setDeletingStore(null);
    if (store) await removeStore(store.id);
  };

  const createList = async (name, storeId = null) => {
    const id = await createListRow(name, storeId);
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
          {lists.map(l => {
            const store = l.storeId ? storeMap[l.storeId] : null;
            return (
              <button key={l.id}
                className={`shop-list-chip ${store ? 'shop-list-chip--store' : ''} ${activeList?.id === l.id ? 'shop-list-chip--active' : ''}`}
                onClick={() => setActiveId(l.id)}>
                {store && <StoreIcon store={store} size={16} />}
                {l.name}
              </button>
            );
          })}
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
        {activeList && (stores.length > 0 || activeList.storeId) && (
          <select className="form-select sm store-link-select"
            value={storeMap[activeList.storeId] ? activeList.storeId : ''}
            onChange={e => linkListToStore(activeList.id, e.target.value || null)}
            aria-label="Store for this list">
            <option value="">No store</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
          </select>
        )}
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
              purchaseByItem={purchaseByItem} stores={stores} onConfirmPrice={confirmPurchase}
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
        {activeSection === 'items' && insights && (
          <ItemsView
            products={products} purchases={purchases} insights={insights}
            categories={categories} catMap={catMap}
            stores={stores} storeMap={storeMap} lists={lists} activeListId={activeList?.id ?? null}
            onListProductIds={onListProductIds} actions={catalogActions}
            onLookup={lookupProduct} sample={sample} />
        )}
        {activeSection === 'stores' && (
          <StoresView
            stores={stores} storeCategories={storeCategories} lists={lists}
            onAdd={() => setStoreForm(null)}
            onEdit={setStoreForm}
            onDelete={setDeletingStore}
            onAddList={handleAddListForStore}
            onLinkList={linkListToStore}
            onOpenList={openList}
            onManageCategories={() => setShowStoreCats(true)} />
        )}
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
          prefill={!editingItem ? scanLookup.prefill : null}
          lookup={!editingItem && scanDraft ? scanLookup : null}
          onSave={updates => {
            if (editingItem) updateItem(editingItem.id, updates);
            else createItemInList(activeList?.id, updates);
            setEditingItem(null);
            setScanDraft(null);
            setScanLookup({ status: 'idle', code: null, prefill: null, message: '' });
          }}
          onClose={() => {
            setEditingItem(null);
            setScanDraft(null);
            setScanLookup({ status: 'idle', code: null, prefill: null, message: '' });
          }} />
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
        <NewListDialog stores={stores} onCreate={createList} onClose={() => setShowNewList(false)} />
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

      {storeForm !== undefined && (
        <StoreFormModal
          store={storeForm}
          categories={storeCategories}
          escapeDisabled={showStoreCats}
          onSave={handleSaveStore}
          onManageCategories={() => setShowStoreCats(true)}
          onClose={() => setStoreForm(undefined)} />
      )}

      {showStoreCats && (
        <ManageCategoriesModal
          title="Store Categories"
          categories={storeCategories}
          newEmojiDefault="🏪"
          protectedIds={[OTHER_STORE_CATEGORY_ID]}
          onSave={cats => saveStoreCategories(cats).catch(console.error)}
          onClose={() => setShowStoreCats(false)} />
      )}

      {deletingStore && (
        <ConfirmModal
          title="Delete store?"
          message={`"${deletingStore.name}" will be removed. Its shopping lists are kept as regular lists.`}
          confirmLabel="Delete store"
          onConfirm={() => confirmDeleteStore()}
          onClose={() => setDeletingStore(null)} />
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
