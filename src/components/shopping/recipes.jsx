// Recipes: cards, the recipe editor, and the add-to-list flow.
import React, { useState, useMemo, useRef } from 'react';
import { newId } from '../../db/ids';
import { IconX, IconPlus, IconTrash, IconPencil, IconCheck, IconCart, IconBook, IconCamera, IconClock, IconServings } from './icons.jsx';
import { parseOne, recipeStock, resizeImage } from './parsing.js';
import { ConfirmModal } from './dialogs.jsx';
import { PantryTracker, PantryManageModal } from './pantry.jsx';

function RecipeCard({ recipe, pantryByName, onAddToList, onEdit, onDelete }) {
  const { have, total } = recipeStock(recipe, pantryByName);
  const stockLow = total > 0 && have < total;

  return (
    <div className="recipe-card">
      <div className="recipe-card-media">
        {recipe.image
          ? <img src={recipe.image} alt={recipe.name} />
          : <div className="recipe-card-noimg"><IconBook /></div>}
      </div>

      <div className="recipe-card-body">
        <div>
          <div className="recipe-card-top">
            <h3 className="recipe-card-name">{recipe.name}</h3>
            {recipe.country && <span className="recipe-card-country">{recipe.country}</span>}
          </div>
          {recipe.description && <p className="recipe-card-desc">{recipe.description}</p>}
          <div className="recipe-card-meta">
            {recipe.prepTime > 0 && (
              <span className="recipe-meta-chip"><IconClock /> {recipe.prepTime}m</span>
            )}
            {recipe.servings > 0 && (
              <span className="recipe-meta-chip"><IconServings /> {recipe.servings} serving{recipe.servings !== 1 ? 's' : ''}</span>
            )}
            {total > 0 && (
              <span className={`recipe-meta-chip ${stockLow ? 'recipe-meta-chip--warn' : 'recipe-meta-chip--ok'}`}>
                {stockLow ? <IconX /> : <IconCheck />} {have}/{total} in stock
              </span>
            )}
          </div>
        </div>

        <div className="recipe-card-actions">
          <div className="recipe-card-actions-left">
            <button className="btn-primary sm" onClick={() => onAddToList(recipe)}>
              <IconCart /> Add to List
            </button>
            <button className="btn-ghost sm" onClick={() => onEdit(recipe)}>
              <IconPencil /> Edit Recipe
            </button>
          </div>
          <button className="sic-act sic-act--del" onClick={() => onDelete(recipe)} title="Delete recipe">
            <IconTrash />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── RecipeFormModal (Create / Edit — full recipe CRUD form) ───────────────────
function emptyRecipeDraft() {
  return { name: '', description: '', country: '', prepTime: '', servings: '', image: '', ingredients: [], steps: [''] };
}

function RecipeFormModal({ recipe, onSave, onClose }) {
  const [draft, setDraft] = useState(() => recipe ? {
    name:        recipe.name || '',
    description: recipe.description || '',
    country:     recipe.country || '',
    prepTime:    recipe.prepTime || '',
    servings:    recipe.servings || '',
    image:       recipe.image || '',
    ingredients: recipe.ingredients ? [...recipe.ingredients] : [],
    steps:       recipe.steps?.length ? [...recipe.steps] : [''],
  } : emptyRecipeDraft());
  const [ingInput, setIngInput] = useState('');
  const [imgError, setImgError] = useState('');
  const fileRef = useRef(null);

  function addIngredient() {
    const p = parseOne(ingInput);
    if (!p?.name.trim()) return;
    setDraft(d => ({ ...d, ingredients: [...d.ingredients, p] }));
    setIngInput('');
  }
  function removeIngredient(i) {
    setDraft(d => ({ ...d, ingredients: d.ingredients.filter((_, j) => j !== i) }));
  }
  function updateStep(i, val) {
    setDraft(d => ({ ...d, steps: d.steps.map((s, j) => j === i ? val : s) }));
  }
  function addStep() {
    setDraft(d => ({ ...d, steps: [...d.steps, ''] }));
  }
  function removeStep(i) {
    setDraft(d => ({ ...d, steps: d.steps.filter((_, j) => j !== i) }));
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setImgError('Please choose an image file.'); return; }
    if (file.size > 8 * 1024 * 1024) { setImgError('Image is too large (max 8MB).'); return; }
    setImgError('');
    try {
      const dataUrl = await resizeImage(file);
      setDraft(d => ({ ...d, image: dataUrl }));
    } catch {
      setImgError('Could not read that image.');
    }
    e.target.value = '';
  }

  function handleSave() {
    if (!draft.name.trim() || !draft.ingredients.length) return;
    onSave({
      name:        draft.name.trim(),
      description: draft.description.trim(),
      country:     draft.country.trim(),
      prepTime:    parseInt(draft.prepTime) || 0,
      servings:    parseInt(draft.servings) || 0,
      image:       draft.image,
      ingredients: draft.ingredients,
      steps:       draft.steps.map(s => s.trim()).filter(Boolean),
    });
  }

  const canSave = draft.name.trim() && draft.ingredients.length > 0;

  return (
    <div className="shop-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="shop-dialog shop-dialog--lg">
        <div className="shop-dialog-header">
          <h4 className="shop-dialog-title">{recipe ? 'Edit Recipe' : 'Create Recipe'}</h4>
          <button className="sic-act" onClick={onClose}><IconX /></button>
        </div>

        <div className="shop-dialog-body">
          {/* Photo */}
          <div className="shop-field">
            <label className="shop-field-label">Picture</label>
            <div className="recipe-photo-row">
              <div className="recipe-photo-preview">
                {draft.image ? <img src={draft.image} alt="Recipe" /> : <IconCamera />}
              </div>
              <div className="recipe-photo-actions">
                <button className="btn-ghost sm" onClick={() => fileRef.current?.click()}>
                  <IconCamera /> {draft.image ? 'Change photo' : 'Upload photo'}
                </button>
                {draft.image && (
                  <button className="btn-ghost sm" onClick={() => setDraft(d => ({ ...d, image: '' }))}>Remove photo</button>
                )}
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
                {imgError && <p className="field-error">{imgError}</p>}
              </div>
            </div>
          </div>

          {/* Name */}
          <div className="shop-field">
            <label className="shop-field-label">Recipe name</label>
            <input className="form-input" placeholder="e.g. Chicken Tikka Masala" autoFocus
              value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
          </div>

          {/* Description */}
          <div className="shop-field">
            <label className="shop-field-label">Description</label>
            <textarea className="form-textarea" rows={2} placeholder="A short description of this dish…"
              value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} />
          </div>

          {/* Country / Time / Servings */}
          <div className="shop-field-row">
            <div className="shop-field">
              <label className="shop-field-label">Country / Cuisine</label>
              <input className="form-input" placeholder="e.g. Indian" value={draft.country}
                onChange={e => setDraft(d => ({ ...d, country: e.target.value }))} />
            </div>
            <div className="shop-field">
              <label className="shop-field-label">Elaboration time (min)</label>
              <input className="form-input" type="number" min="0" placeholder="45" value={draft.prepTime}
                onChange={e => setDraft(d => ({ ...d, prepTime: e.target.value }))} />
            </div>
            <div className="shop-field">
              <label className="shop-field-label">Servings</label>
              <input className="form-input" type="number" min="0" placeholder="4" value={draft.servings}
                onChange={e => setDraft(d => ({ ...d, servings: e.target.value }))} />
            </div>
          </div>

          {/* Ingredients */}
          <div className="shop-field">
            <label className="shop-field-label">Ingredients</label>
            {draft.ingredients.map((ing, i) => (
              <div key={i} className="shop-ing-row">
                <span>{ing.qty > 1 ? `${ing.qty} ` : ''}{ing.unit ? `${ing.unit} ` : ''}{ing.name}</span>
                <button className="sic-act sic-act--del" onClick={() => removeIngredient(i)}><IconX /></button>
              </div>
            ))}
            <div className="shop-ing-add-row">
              <input className="form-input" style={{ flex: 1 }} placeholder="Add ingredient (e.g. 2 cups flour)…"
                value={ingInput} onChange={e => setIngInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addIngredient(); } }} />
              <button className="btn-ghost sm" onClick={addIngredient} disabled={!ingInput.trim()}>Add</button>
            </div>
          </div>

          {/* Elaboration / Steps */}
          <div className="shop-field">
            <label className="shop-field-label">Elaboration (steps)</label>
            <div className="recipe-steps-list">
              {draft.steps.map((step, i) => (
                <div key={i} className="recipe-step-row">
                  <span className="recipe-step-num">{i + 1}</span>
                  <textarea className="form-textarea" rows={1} placeholder={`Step ${i + 1}…`}
                    value={step} onChange={e => updateStep(i, e.target.value)} />
                  {draft.steps.length > 1 && (
                    <button className="sic-act sic-act--del" onClick={() => removeStep(i)}><IconX /></button>
                  )}
                </div>
              ))}
            </div>
            <button className="btn-ghost sm" style={{ marginTop: 6 }} onClick={addStep}><IconPlus /> Add step</button>
          </div>
        </div>

        <div className="shop-dialog-actions">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={!canSave}>
            {recipe ? 'Save Changes' : 'Save Recipe'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AddToListConfirmModal ──────────────────────────────────────────────────────
function AddToListConfirmModal({ recipe, lists, defaultListId, pantryByName, onConfirm, onClose }) {
  const [targetListId, setTargetListId] = useState(defaultListId || lists[0]?.id);
  const [skipStocked,  setSkipStocked]  = useState(true);
  const [done,         setDone]         = useState(false);

  const targetList = lists.find(l => l.id === targetListId) || lists[0];

  const rows = recipe.ingredients.map(ing => ({
    ...ing,
    inStock: !!(pantryByName[ing.name.toLowerCase()]?.qty > 0),
  }));
  const toAdd = skipStocked ? rows.filter(r => !r.inStock) : rows;

  function confirm() {
    onConfirm(toAdd, targetListId);
    setDone(true);
    setTimeout(onClose, 1200);
  }

  return (
    <div className="shop-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="shop-dialog">
        {done ? (
          <div className="shop-planner-success">
            <span className="shop-planner-success-icon">✅</span>
            <p>{toAdd.length} item{toAdd.length !== 1 ? 's' : ''} added to "{targetList?.name}"!</p>
          </div>
        ) : (
          <>
            <div className="shop-dialog-header">
              <h4 className="shop-dialog-title">Add "{recipe.name}" to List</h4>
              <button className="sic-act" onClick={onClose}><IconX /></button>
            </div>

            {lists.length > 1 ? (
              <div className="shop-field">
                <label className="shop-field-label">Add to which list?</label>
                <div className="atl-list-picker">
                  {lists.map(l => (
                    <button key={l.id}
                      className={`shop-list-chip ${targetListId === l.id ? 'shop-list-chip--active' : ''}`}
                      onClick={() => setTargetListId(l.id)}>
                      {l.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="shop-dialog-subtitle">Adds ingredients to <strong>"{targetList?.name}"</strong></p>
            )}

            <div className="atl-list">
              {rows.map((r, i) => (
                <div key={i} className={`atl-row ${r.inStock ? 'atl-row--stock' : ''}`}>
                  <span className="atl-status">{r.inStock ? <IconCheck /> : <IconCart />}</span>
                  <span className="atl-name">{r.qty > 1 ? `${r.qty} ` : ''}{r.unit ? `${r.unit} ` : ''}{r.name}</span>
                  {r.inStock && <span className="atl-tag">In pantry</span>}
                </div>
              ))}
            </div>

            <div className="toggle-row atl-toggle-row" onClick={() => setSkipStocked(s => !s)}>
              <span>Skip items already in pantry</span>
              <span className={`toggle-switch ${skipStocked ? 'on' : ''}`} />
            </div>

            <div className="shop-dialog-actions">
              <button className="btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn-primary" onClick={confirm} disabled={!toAdd.length || !targetListId}>
                Add {toAdd.length} item{toAdd.length !== 1 ? 's' : ''}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── PantryTracker (compact widget shown alongside recipes) ────────────────────

function RecipesView({ recipes, onSaveRecipe, onDeleteRecipe, onAddIngredients, lists, activeListId, pantryItems, onSavePantry, units }) {
  const [formRecipe,   setFormRecipe]   = useState(undefined); // undefined=closed, null=create, object=edit
  const [addTarget,    setAddTarget]    = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showPantry,   setShowPantry]   = useState(false);

  const pantryByName = useMemo(
    () => Object.fromEntries(pantryItems.map(p => [p.name.toLowerCase(), p])),
    [pantryItems]
  );

  function saveRecipe(data) {
    if (formRecipe?.id) {
      onSaveRecipe(prev => prev.map(r => r.id === formRecipe.id ? { ...r, ...data } : r));
    } else {
      onSaveRecipe(prev => [...prev, { id: newId(), ...data, createdAt: new Date().toISOString() }]);
    }
    setFormRecipe(undefined);
  }

  return (
    <div className="shop-center-content">
      <div className="shop-center-header recipe-mode-header">
        <div>
          <h2 className="shop-center-title">Recipes</h2>
          <p className="recipe-mode-sub">Manage your culinary inspirations and sync them instantly to your shopping list.</p>
        </div>
        <button className="btn-primary" onClick={() => setFormRecipe(null)}>
          <IconPlus /> Create Recipe
        </button>
      </div>

      <div className="shop-center-scroll">
        <div className="recipe-bento">
          <div className="recipe-list-col">
            {recipes.length === 0 && (
              <div className="empty-state">
                <span style={{ fontSize: 40 }}>📖</span>
                <p className="empty-title">No recipes yet</p>
                <p className="empty-sub">Create a recipe to add all its ingredients in one tap</p>
              </div>
            )}
            {recipes.map(r => (
              <RecipeCard key={r.id} recipe={r} pantryByName={pantryByName}
                onAddToList={setAddTarget}
                onEdit={setFormRecipe}
                onDelete={setDeleteTarget} />
            ))}
          </div>

          <div className="recipe-side-col">
            <PantryTracker items={pantryItems} onManage={() => setShowPantry(true)} />
          </div>
        </div>
      </div>

      {formRecipe !== undefined && (
        <RecipeFormModal recipe={formRecipe} onSave={saveRecipe} onClose={() => setFormRecipe(undefined)} />
      )}

      {addTarget && (
        <AddToListConfirmModal recipe={addTarget} lists={lists} defaultListId={activeListId} pantryByName={pantryByName}
          onConfirm={(items, targetListId) => onAddIngredients(items, targetListId, addTarget.name)}
          onClose={() => setAddTarget(null)} />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Recipe?"
          message={<>Are you sure you want to delete <strong>"{deleteTarget.name}"</strong>? This can't be undone.</>}
          confirmLabel="Delete"
          onConfirm={() => { onDeleteRecipe(deleteTarget.id); setDeleteTarget(null); }}
          onClose={() => setDeleteTarget(null)} />
      )}

      {showPantry && (
        <PantryManageModal items={pantryItems} units={units}
          onSave={onSavePantry}
          onClose={() => setShowPantry(false)} />
      )}
    </div>
  );
}

// BudgetView now lives in its own module (./BudgetView.jsx) — the Monthly
// Budget section grew into a self-contained personal-finance subsystem
// (income, bills, categories, expenses) rather than a grocery-total widget.

// ── AllItemsView (center content for All Items section) ───────────────────────

export { RecipeCard, emptyRecipeDraft, RecipeFormModal, AddToListConfirmModal, RecipesView };
