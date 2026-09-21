/**
 * Operations on the product catalog.
 */
import { db } from './schema';
import { newId, now } from './ids';
import { isLive } from './repo';
import { addItemToList } from './shoppingOps';
import { nameKey } from '../utils/products';
import { isSafeImage } from '../utils/stores';
import type { Product } from './types';

/** What a caller supplies to create or edit a product. */
export type ProductInput = Pick<
  Product,
  'name' | 'category' | 'brand' | 'packageSize' | 'barcode' | 'photo' | 'notes'
>;

export class InvalidProductError extends Error {
  override name = 'InvalidProductError';
}

/** Thrown when the same name + brand + size already exists. */
export class DuplicateProductError extends Error {
  override name = 'DuplicateProductError';
  readonly existingId: string;

  constructor(existingId: string) {
    super('You already have this product.');
    this.existingId = existingId;
  }
}

export function normalizeProductInput(input: ProductInput): ProductInput {
  const name = input.name.trim();
  if (!name) throw new InvalidProductError('A product needs a name.');

  return {
    name,
    category: input.category || 'other',
    brand: input.brand.trim(),
    packageSize: input.packageSize.trim(),
    barcode: input.barcode.trim(),
    // Only an inline image is ever kept: this field also arrives through backup
    // import, and anything else would be fetched from wherever it points.
    photo: isSafeImage(input.photo) ? input.photo : null,
    notes: input.notes.trim(),
  };
}

/**
 * "Organic Valley · 1 gal" — what tells two products with the same name apart on
 * a list, which has a note column but no brand column.
 */
export function describeVariant(product: Pick<Product, 'brand' | 'packageSize'>): string {
  return [product.brand.trim(), product.packageSize.trim()].filter(Boolean).join(' · ');
}

/** "Same product" means the same name, brand and size — not just the same name. */
function sameProduct(a: Pick<Product, 'name' | 'brand' | 'packageSize'>, b: typeof a): boolean {
  return nameKey(a.name) === nameKey(b.name)
    && nameKey(a.brand) === nameKey(b.brand)
    && nameKey(a.packageSize) === nameKey(b.packageSize);
}

export interface CreateProductOptions {
  /** Also put the new product on this list. */
  addToListId?: string;
}

export async function createProduct(
  input: ProductInput,
  options: CreateProductOptions = {},
): Promise<string> {
  const clean = normalizeProductInput(input);
  const id = newId();
  const timestamp = now();

  await db.transaction('rw', db.products, async () => {
    const live = (await db.products.toArray()).filter(isLive);
    const duplicate = live.find(p => sameProduct(p, clean));
    if (duplicate) throw new DuplicateProductError(duplicate.id);

    await db.products.put({
      ...clean,
      id,
      nameKey: nameKey(clean.name),
      priorPurchases: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    });
  });

  if (options.addToListId) {
    await addItemToList(options.addToListId, {
      name: clean.name, category: clean.category, barcode: clean.barcode, productId: id,
      note: describeVariant(clean),
    });
  }
  return id;
}

/**
 * Edits a product.
 *
 * Renaming also renames the copies of it waiting on a list, but only unticked
 * ones that still carry the old name — the same rule stores use for their lists,
 * so something already bought (or renamed by hand) is left as it was.
 */
export async function updateProduct(id: string, input: ProductInput): Promise<void> {
  const clean = normalizeProductInput(input);

  await db.transaction('rw', db.products, db.shoppingItems, async () => {
    const existing = await db.products.get(id);
    if (!existing || !isLive(existing)) return;

    const others = (await db.products.toArray()).filter(p => isLive(p) && p.id !== id);
    const duplicate = others.find(p => sameProduct(p, clean));
    if (duplicate) throw new DuplicateProductError(duplicate.id);

    const timestamp = now();
    await db.products.put({
      ...existing,
      ...clean,
      nameKey: nameKey(clean.name),
      updatedAt: timestamp,
    });

    if (existing.name !== clean.name) {
      const waiting = (await db.shoppingItems.toArray()).filter(
        i => isLive(i) && i.productId === id && !i.checked && i.name === existing.name,
      );
      await db.shoppingItems.bulkPut(
        waiting.map(i => ({ ...i, name: clean.name, updatedAt: timestamp })),
      );
    }
  });
}

/**
 * Deletes a product and its purchase history.
 *
 * Copies still on a list are unlinked rather than deleted. Because anything on
 * a list belongs in the catalog, such an item gets a fresh, history-free product
 * at the next opportunity — the user is told this before confirming.
 */
export async function removeProduct(id: string): Promise<void> {
  await db.transaction('rw', db.products, db.purchases, db.shoppingItems, async () => {
    const timestamp = now();

    const purchases = (await db.purchases.where('productId').equals(id).toArray()).filter(isLive);
    await db.purchases.bulkPut(
      purchases.map(p => ({ ...p, deletedAt: timestamp, updatedAt: timestamp })),
    );

    const items = (await db.shoppingItems.toArray()).filter(i => isLive(i) && i.productId === id);
    await db.shoppingItems.bulkPut(items.map(i => ({ ...i, productId: null, updatedAt: timestamp })));

    await db.products.update(id, { deletedAt: timestamp, updatedAt: timestamp });
  });
}

/** Puts one more of a product on a list. */
export async function addProductToList(
  productId: string,
  listId: string,
  qty = 1,
): Promise<void> {
  const product = await db.products.get(productId);
  if (!product || !isLive(product)) return;
  await addItemToList(listId, {
    name: product.name,
    qty,
    category: product.category,
    barcode: product.barcode,
    productId,
    note: describeVariant(product),
  });
}
