import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';
import { useShoppingPrefs } from '../hooks/useShoppingPrefs';
import { categorize } from '../data/shoppingCategories.js';
import ShoppingStoreMode from './ShoppingStoreMode.jsx';
import BudgetView from './BudgetView.jsx';
import {
  IconPlus, IconShare, IconSparkle, IconChevron,
  IconCalendar, IconNavigation, IconBarcode, NAV,
} from './shopping/icons.jsx';
import { parseWithCatalog, getSuggestions, daysSince } from './shopping/parsing.js';
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
import { AddItemBar, NotFoundNotice } from './shopping/AddItemBar.jsx';
import { ProductFormModal } from './shopping/ProductFormModal.jsx';
import { resolveByName, popularityOf } from '../utils/productSearch';
import { loadSampleData, removeSampleData } from '../demo/sampleData';
import { describeVariant } from '../db/productOps';
import { toLocalDate, parseDateOnly } from '../utils/products';

export default function ShoppingList({
  lists, history, recipes, setRecipes, onAddToPlanner,
  // Optional: the parent owns which section shows (the phone menu jumps to one).
  section, onSectionChange,
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
  const [ownSection,     setOwnSection]     = useState('lists');
  const activeSection = section ?? ownSection;
  const setActiveSection = onSectionChange ?? setOwnSection;
  const isMobile = useIsMobile();
  // The phone section strip scrolls sideways; keep the current section in view.
  useEffect(() => {
    if (!isMobile) return;
    document.querySelector('.shop-subnav-item--active')
      ?.scrollIntoView?.({ inline: 'center', block: 'nearest' });
  }, [isMobile, activeSection]);
  const [activeId,       setActiveId]       = useState(() => lists[0]?.id || null);
  const [storeMode,      setStoreMode]      = useState(false);
  const [moreOpen,       setMoreOpen]       = useState(false); // phones: the list's less-used tools
  // Store Mode is full-screen: let the stylesheet tuck the phone tab bar away.
  useEffect(() => {
    const root = document.documentElement;
    if (storeMode) root.setAttribute('data-store-mode', '');
    else root.removeAttribute('data-store-mode');
    return () => root.removeAttribute('data-store-mode');
  }, [storeMode]);
  const [editingItem,    setEditingItem]    = useState(null);
  const [deletingItem,   setDeletingItem]   = useState(null);
  // Text that could not be placed on a catalog product ("Product not found"), and
  // the new-product form opened from it or from the scanner.
  const [problems,       setProblems]       = useState([]);
  const [newProduct,     setNewProduct]     = useState(null);
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

  // ── Adding items from the catalog ──────────────────────────────────────────
  // Nothing on this list is created from free text. An item is registered on a
  // catalog product: picked from the suggestions, or matched by name. Whatever
  // cannot be placed is reported as "Product not found" so that it is added as a
  // new product on purpose. That is what stops "Milk", "milk 1 gal" and a typo
  // from becoming three products with three separate price histories.
  const popularity = useMemo(() => popularityOf(products, purchases), [products, purchases]);

  const addProduct = useCallback((product, { qty = 1, unit = '' } = {}) => {
    if (!activeList) return;
    addItemRow(activeList.id, {
      name: product.name, qty, unit,
      category: product.category || categorize(product.name),
      barcode: product.barcode,
      // The exact product, so a second brand of "Milk" is never mistaken for this one.
      productId: product.id,
      note: describeVariant(product),
    });
  }, [activeList, addItemRow]);

  // Places each parsed item on its product, and returns the ones it could not.
  const addParsed = useCallback((parsedItems) => {
    const unresolved = [];
    for (const parsed of parsedItems) {
      const result = resolveByName(products, parsed.name, popularity);
      if (result.kind === 'match') {
        addProduct(result.product, parsed);
      } else {
        unresolved.push({
          ...parsed,
          reason: result.kind,
          options: result.kind === 'ambiguous' ? result.options : [],
        });
      }
    }
    setProblems(unresolved);
    return unresolved;
  }, [products, popularity, addProduct]);

  const addItem = useCallback((parsed) => { addParsed([parsed]); }, [addParsed]);

  // ── Voice ─────────────────────────────────────────────────────────────────
  const handleVoiceResult = useCallback((transcript) => {
    addParsed(parseWithCatalog(transcript, products));
  }, [addParsed, products]);

  const handleVoiceError = useCallback((msg) => {
    setVoiceError(msg);
    setTimeout(() => setVoiceError(''), 5000);
  }, []);

  const { listening, interim, start: startVoice, stop: stopVoice, supported: voiceOk } = useVoice(handleVoiceResult, handleVoiceError);

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

  // Returns { found } so the scan modal knows whether to keep scanning. A code that
  // is not in the catalog is NOT added: the scan modal says "Product not found"
  // and offers to add it as a new product (see onAddNew), so a scan can never
  // create a duplicate.
  const handleScannedCode = useCallback((code) => {
    const product = productByBarcode[code];
    if (!product) return { found: false };
    addKnownProduct({ ...product, barcode: code });
    return { found: true, name: product.name };
  }, [productByBarcode, addKnownProduct]);

  // ── "Product not found" → add it as a new product ────────────────────────
  const capitalise = (text) => text.charAt(0).toUpperCase() + text.slice(1);

  const pickOption = (problem, product) => {
    addProduct(product, problem);
    setProblems(ps => ps.filter(p => p !== problem));
  };

  const startNewProduct = (problem) => setNewProduct({
    name: capitalise(problem.name), barcode: '', qty: problem.qty, unit: problem.unit, problem,
  });

  const saveNewProduct = async (input, { addToListId }) => {
    const draft = newProduct;
    await createProduct(input, { addToListId, qty: draft.qty, unit: draft.unit });
    setProblems(ps => ps.filter(p => p !== draft.problem));
    setNewProduct(null);
  };

  // The new-product form found that it already exists (same name, brand and size):
  // put that one on the list instead of making a second.
  const chooseExistingProduct = (productId) => {
    const draft = newProduct;
    const existing = products.find(p => p.id === productId);
    if (existing) addProduct(existing, draft);
    setProblems(ps => ps.filter(p => p !== draft.problem));
    setNewProduct(null);
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
          {isMobile && (
            <button type="button" className="shop-list-chip shop-list-chip--new"
              onClick={() => setShowNewList(true)} aria-label="New shopping list">
              <IconPlus /> New
            </button>
          )}
        </div>
        <button className="shop-store-mode-btn" onClick={() => setStoreMode(true)}>
          <IconNavigation /><span>Store Mode</span>
        </button>
      </div>
      <div className={`shop-list-secondary-actions${isMobile ? ' shop-list-secondary-actions--m' : ''}${moreOpen ? ' is-open' : ''}`}>
        <button className="btn-ghost sm" onClick={() => setShowScan(true)} disabled={!activeList}>
          <IconBarcode /> Scan Item
        </button>
        {isMobile && (
          <button type="button" className="btn-ghost sm shop-more-btn"
            aria-expanded={moreOpen} onClick={() => setMoreOpen(o => !o)}>
            {moreOpen ? 'Less' : 'More'} <IconChevron up={moreOpen} />
          </button>
        )}
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

      {/* Find an item to add — registered on that exact product */}
      <AddItemBar
        products={products} popularity={popularity} categoryMap={catMap}
        onListProductIds={onListProductIds} voice={{ listening, interim, start: startVoice, stop: stopVoice, supported: voiceOk }}
        onAddProduct={addProduct} onAddParsed={addParsed} disabled={!activeList} />
      {voiceError && <p className="shop-voice-error">{voiceError}</p>}
      <NotFoundNotice problems={problems} categoryMap={catMap}
        onPickOption={pickOption} onAddNew={startNewProduct} onDismiss={() => setProblems([])} />

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
        {/* Phones: the sections as a strip along the top (the left panel is hidden). */}
        {isMobile && !storeMode && (
          <nav className="shop-subnav" aria-label="Shopping sections">
            {NAV.map(({ id, label, short, Icon }) => (
              <button key={id} type="button"
                className={`shop-subnav-item${activeSection === id ? ' shop-subnav-item--active' : ''}`}
                aria-current={activeSection === id ? 'page' : undefined}
                onClick={() => setActiveSection(id)}>
                <Icon />
                <span>{short ?? label}</span>
              </button>
            ))}
          </nav>
        )}
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
      {editingItem && (
        <EditItemModal
          item={editingItem}
          isNew={false}
          categories={categories}
          units={units}
          onSave={updates => {
            updateItem(editingItem.id, updates);
            setEditingItem(null);
          }}
          onClose={() => setEditingItem(null)} />
      )}

      {newProduct && (
        <ProductFormModal
          product={null}
          initial={{
            name: newProduct.name,
            barcode: newProduct.barcode,
            category: newProduct.name ? categorize(newProduct.name) : undefined,
          }}
          defaultAddToList
          autoLookup={Boolean(newProduct.barcode)}
          categories={categories} lists={lists} defaultListId={activeList?.id}
          existingLabel="Add that one instead"
          onSave={saveNewProduct} onOpenExisting={chooseExistingProduct} onLookup={lookupProduct}
          onClose={() => setNewProduct(null)} />
      )}

      {showScan && (
        <ScanItemModal
          onCode={handleScannedCode}
          onAddNew={code => { setShowScan(false); setNewProduct({ name: '', barcode: code, qty: 1, unit: '', problem: null }); }}
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

    </>
  );
}
