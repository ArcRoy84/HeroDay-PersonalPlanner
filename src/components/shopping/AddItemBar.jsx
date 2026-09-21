// The "add to list" bar: type to find an item, pick it, and it is registered on
// that exact product. Nothing is created from free text.
//
// Why: adding by name used to create a catalog product whenever the text did not
// match one exactly, so "Milk", "milk 1 gal" and a typo each became their own
// product with their own price history. Picking from the catalog is what keeps
// one thing as one product.
import React, { useEffect, useId, useRef, useState } from 'react';
import { IconCart, IconMic, IconPlus } from './icons.jsx';
import { ProductThumb } from './productParts.jsx';
import { parseWithCatalog } from './parsing.js';
import { searchProducts } from '../../utils/productSearch';
import { describeVariant } from '../../db/productOps';

/** Puts a parsed item back into the words a person would type. */
function formatParsed({ qty, unit, name }) {
  return [qty !== 1 ? qty : '', unit, name].filter(Boolean).join(' ');
}

/**
 * `products` and `popularity` feed the suggestions; `onListProductIds` marks the
 * ones already on the list. `onAddProduct(product, { qty, unit })` registers a
 * pick. `onAddParsed(items)` handles free text that is not a visible pick (a
 * comma-separated batch) and returns what it could not place, which stays in the
 * box so it can be fixed or added as a new product.
 */
function AddItemBar({
  products, popularity, categoryMap, onListProductIds, voice,
  onAddProduct, onAddParsed, disabled = false,
}) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listId = useId();

  const segments = parseWithCatalog(text, products);
  // A single item gets suggestions to choose from. A batch ("milk, eggs") does not:
  // each part is matched on its own when it is submitted.
  const single = segments.length === 1 ? segments[0] : null;
  const suggestions = single ? searchProducts(products, single.name, { popularity }) : [];
  const listening = voice.listening;
  const showList = open && !listening && suggestions.length > 0;

  // A new query starts at the top of its results.
  useEffect(() => { setActive(0); }, [text]);

  function pick(product) {
    onAddProduct(product, { qty: single?.qty ?? 1, unit: single?.unit ?? '' });
    setText('');
    setOpen(false);
    inputRef.current?.focus();
  }

  function submit() {
    if (!text.trim() || listening || disabled) return;
    if (single && suggestions.length > 0) {
      pick(suggestions[Math.min(active, suggestions.length - 1)]);
      return;
    }
    const leftover = onAddParsed(segments);
    setText(leftover.map(formatParsed).join(', '));
    setOpen(false);
    inputRef.current?.focus();
  }

  function onKeyDown(event) {
    // Enter while an input method is composing a character is not "submit".
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'ArrowDown' && suggestions.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActive(a => (a + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp' && suggestions.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActive(a => (a - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      submit();
    } else if (event.key === 'Escape' && showList) {
      // Only swallow Escape while there is a list to dismiss.
      event.stopPropagation();
      setOpen(false);
    }
  }

  const activeId = showList ? `${listId}-opt-${active}` : undefined;

  return (
    <div className="shop-search-bar addbar">
      <span className="shop-search-icon"><IconCart /></span>
      <input
        ref={inputRef}
        className="shop-search-input"
        role="combobox"
        aria-label="Find an item to add"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={activeId}
        autoComplete="off"
        placeholder={listening
          ? (voice.interim || 'Listening… try "2 lbs chicken and a dozen eggs"')
          : 'Find an item to add… e.g. 2 lbs apples'}
        value={listening ? voice.interim : text}
        onChange={e => { if (!listening) { setText(e.target.value); setOpen(true); } }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        readOnly={listening}
      />
      <button type="button"
        className={`shop-mic-btn${listening ? ' shop-mic-btn--on' : ''}`}
        onClick={listening ? voice.stop : voice.start}
        disabled={!voice.supported}
        title={voice.supported ? (listening ? 'Stop' : 'Voice input') : 'Voice not supported'}>
        <IconMic />
        {listening && <span className="mic-ring" />}
      </button>
      <button type="button" className="shop-search-add" onClick={submit}
        disabled={!text.trim() || listening || disabled} aria-label="Add">
        <IconPlus />
      </button>

      {showList && (
        <ul id={listId} className="asuggest" role="listbox" aria-label="Matching items">
          {suggestions.map((product, i) => {
            const variant = describeVariant(product);
            const onList = onListProductIds.has(product.id);
            return (
              <li key={product.id} id={`${listId}-opt-${i}`} role="option" aria-selected={i === active}
                className={`asuggest-opt ${i === active ? 'asuggest-opt--active' : ''}`}
                // Keep focus in the input: a click must not blur it (and close the list) first.
                onMouseDown={e => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(product)}>
                <ProductThumb product={product} category={categoryMap[product.category]} size={30} />
                <span className="asuggest-text">
                  <span className="asuggest-name">{product.name}</span>
                  {variant && <span className="asuggest-sub">{variant}</span>}
                </span>
                {onList && <span className="asuggest-tag">On this list</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * "Product not found" — shown when typed or spoken text could not be placed on a
 * product. It says what to do about it, and never creates anything by itself.
 * `problems` are `{ name, qty, unit, reason, options }`; the first is shown.
 */
function NotFoundNotice({ problems, categoryMap, onPickOption, onAddNew, onDismiss }) {
  if (problems.length === 0) return null;
  const [first] = problems;
  const more = problems.length - 1;

  return (
    <div className="notfound" role="alert">
      <div className="notfound-body">
        {first.reason === 'ambiguous' ? (
          <>
            <p className="notfound-title">Which “{first.name}”?</p>
            <p className="notfound-text">More than one item fits. Pick the one you mean:</p>
            <ul className="notfound-options">
              {first.options.map(product => (
                <li key={product.id}>
                  <button type="button" className="notfound-option" onClick={() => onPickOption(first, product)}>
                    <ProductThumb product={product} category={categoryMap[product.category]} size={26} />
                    <span>
                      <span className="asuggest-name">{product.name}</span>
                      {describeVariant(product) && <span className="asuggest-sub">{describeVariant(product)}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p className="notfound-title">Product not found</p>
            <p className="notfound-text">
              “{first.name}” isn’t in your items yet. Add it as a new product so it is tracked,
              and picked from here next time.
            </p>
          </>
        )}
        {more > 0 && <p className="notfound-more">{more} more not found</p>}
      </div>
      <div className="notfound-actions">
        <button type="button" className="btn-primary sm" onClick={() => onAddNew(first)}>Add as new product</button>
        <button type="button" className="btn-ghost sm" onClick={onDismiss}>Dismiss</button>
      </div>
    </div>
  );
}

export { AddItemBar, NotFoundNotice };
