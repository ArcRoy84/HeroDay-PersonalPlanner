import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './schema';
import { isLive } from './repo';
import {
  normalizeProductInput, createProduct, updateProduct, removeProduct, addProductToList,
  InvalidProductError, DuplicateProductError, type ProductInput,
} from './productOps';
import { addItemToList, toggleItemChecked } from './shoppingOps';

const PHOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';
const LIST = 'l1';

const input = (over: Partial<ProductInput> = {}): ProductInput => ({
  name: 'Milk', category: 'dairy', brand: '', packageSize: '', barcode: '', photo: null, notes: '',
  ...over,
});

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map(t => t.clear()));
  await db.shoppingLists.put({
    id: LIST, name: 'Grocery', budget: null, storeId: null,
    createdAt: 'x', updatedAt: 'x', deletedAt: null,
  });
});

describe('normalizeProductInput', () => {
  it('trims fields and defaults the category', () => {
    const clean = normalizeProductInput(input({
      name: '  Milk ', brand: ' Organic Valley ', packageSize: ' 1 gal ', category: '',
    }));
    expect(clean.name).toBe('Milk');
    expect(clean.brand).toBe('Organic Valley');
    expect(clean.packageSize).toBe('1 gal');
    expect(clean.category).toBe('other');
  });

  it('rejects a blank name', () => {
    expect(() => normalizeProductInput(input({ name: '  ' }))).toThrow(InvalidProductError);
  });

  it('keeps an inline photo and drops anything else', () => {
    expect(normalizeProductInput(input({ photo: PHOTO })).photo).toBe(PHOTO);
    expect(normalizeProductInput(input({ photo: 'https://evil.example/x.png' })).photo).toBeNull();
    expect(normalizeProductInput(input({ photo: 'javascript:alert(1)' })).photo).toBeNull();
  });
});

describe('createProduct', () => {
  it('stores a product with its match key', async () => {
    const id = await createProduct(input({ name: 'Whole  Milk', brand: 'Acme', packageSize: '1 gal' }));

    const row = (await db.products.get(id))!;
    expect(row.nameKey).toBe('whole milk');
    expect(row.priorPurchases).toBe(0);
    expect(row.deletedAt).toBeNull();
  });

  it('rejects the same name, brand and size, however it is cased or spaced', async () => {
    const first = await createProduct(input({ brand: 'Acme', packageSize: '1 gal' }));

    const attempt = createProduct(input({ name: ' MILK ', brand: 'acme', packageSize: '1  GAL' }));

    await expect(attempt).rejects.toBeInstanceOf(DuplicateProductError);
    await expect(attempt).rejects.toMatchObject({ existingId: first });
    expect(await db.products.count()).toBe(1);
  });

  it('allows the same name in a different brand or size', async () => {
    await createProduct(input({ brand: 'Acme', packageSize: '1 gal' }));
    await createProduct(input({ brand: 'Other', packageSize: '1 gal' }));
    await createProduct(input({ brand: 'Acme', packageSize: '0.5 gal' }));

    expect(await db.products.count()).toBe(3);
  });

  it('allows a name that was deleted', async () => {
    const first = await createProduct(input());
    await removeProduct(first);

    await expect(createProduct(input())).resolves.toEqual(expect.any(String));
  });

  it('can also put the new product on a list, linked to exactly that product', async () => {
    const id = await createProduct(input({ brand: 'Organic Valley' }), { addToListId: LIST });

    const items = (await db.shoppingItems.toArray()).filter(isLive);
    expect(items).toHaveLength(1);
    expect(items[0]?.productId).toBe(id);
    expect(await db.products.count()).toBe(1);
  });

  it('puts the brand and size in the list note, so two "Milk" rows can be told apart', async () => {
    await createProduct(input({ brand: 'Organic Valley', packageSize: '1 gal' }), { addToListId: LIST });

    const item = (await db.shoppingItems.toArray()).filter(isLive)[0]!;
    expect(item.note).toBe('Organic Valley · 1 gal');
  });

  it('writes nothing when validation fails', async () => {
    await expect(createProduct(input({ name: '' }))).rejects.toThrow(InvalidProductError);
    expect(await db.products.count()).toBe(0);
  });
});

describe('updateProduct', () => {
  it('updates fields', async () => {
    const id = await createProduct(input());
    await updateProduct(id, input({ brand: 'Acme', notes: 'the blue cap' }));

    const row = (await db.products.get(id))!;
    expect(row.brand).toBe('Acme');
    expect(row.notes).toBe('the blue cap');
  });

  it('renames unticked list copies that still carry the old name', async () => {
    const id = await createProduct(input(), { addToListId: LIST });
    await addItemToList(LIST, { name: 'Milk', productId: id }); // merges into the same row

    await updateProduct(id, input({ name: 'Whole Milk' }));

    const item = (await db.shoppingItems.toArray()).find(i => isLive(i))!;
    expect(item.name).toBe('Whole Milk');
    expect((await db.products.get(id))?.nameKey).toBe('whole milk');
  });

  it('leaves a ticked copy alone', async () => {
    const id = await createProduct(input(), { addToListId: LIST });
    const item = (await db.shoppingItems.toArray())[0]!;
    await toggleItemChecked(item.id);

    await updateProduct(id, input({ name: 'Whole Milk' }));

    expect((await db.shoppingItems.get(item.id))?.name).toBe('Milk');
  });

  it('rejects renaming onto another existing product', async () => {
    await createProduct(input({ name: 'Bread' }));
    const milk = await createProduct(input());

    await expect(updateProduct(milk, input({ name: 'bread' }))).rejects.toBeInstanceOf(DuplicateProductError);
    expect((await db.products.get(milk))?.name).toBe('Milk');
  });

  it('allows saving a product without changing its identity', async () => {
    const id = await createProduct(input({ brand: 'Acme' }));
    await expect(updateProduct(id, input({ brand: 'Acme', notes: 'x' }))).resolves.toBeUndefined();
  });

  it('ignores an unknown or deleted product', async () => {
    await updateProduct('ghost', input());
    const id = await createProduct(input());
    await removeProduct(id);
    await updateProduct(id, input({ name: 'Back' }));

    expect((await db.products.toArray()).filter(isLive)).toHaveLength(0);
  });
});

describe('removeProduct', () => {
  it('voids the product and its purchases, and unlinks its list items', async () => {
    const id = await createProduct(input(), { addToListId: LIST });
    const item = (await db.shoppingItems.toArray())[0]!;
    await toggleItemChecked(item.id);
    expect((await db.purchases.toArray()).filter(isLive)).toHaveLength(1);

    await removeProduct(id);

    expect((await db.products.get(id))?.deletedAt).toEqual(expect.any(String));
    expect((await db.purchases.toArray()).filter(isLive)).toHaveLength(0);
    expect((await db.shoppingItems.get(item.id))?.productId).toBeNull();
    // The list item itself is untouched.
    expect((await db.shoppingItems.get(item.id))?.deletedAt).toBeNull();
  });

  it('leaves other products alone', async () => {
    const milk = await createProduct(input(), { addToListId: LIST });
    const bread = await createProduct(input({ name: 'Bread' }), { addToListId: LIST });
    for (const i of await db.shoppingItems.toArray()) await toggleItemChecked(i.id);

    await removeProduct(milk);

    const live = (await db.purchases.toArray()).filter(isLive);
    expect(live).toHaveLength(1);
    expect(live[0]?.productId).toBe(bread);
  });
});

describe('addProductToList', () => {
  it('adds an instance of that exact product, not a same-named one', async () => {
    const plain = await createProduct(input());
    const organic = await createProduct(input({ brand: 'Organic Valley' }));

    await addProductToList(organic, LIST, 2);

    const item = (await db.shoppingItems.toArray()).filter(isLive)[0]!;
    expect(item.productId).toBe(organic);
    expect(item.productId).not.toBe(plain);
    expect(item.qty).toBe(2);
  });

  it('does nothing for a deleted product', async () => {
    const id = await createProduct(input());
    await removeProduct(id);

    await addProductToList(id, LIST);

    expect(await db.shoppingItems.count()).toBe(0);
  });
});
