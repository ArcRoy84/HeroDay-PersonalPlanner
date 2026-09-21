/**
 * Dexie database definition.
 *
 * Indexing notes — IndexedDB will not index `boolean` or `null` values, and a
 * row whose indexed field is `null` silently drops out of that index. So
 * `completed` and `deletedAt` are deliberately *not* indexed; both are filtered
 * in memory instead. At single-user scale (hundreds of tasks, not millions)
 * that is cheaper than maintaining numeric mirror fields that can drift out of
 * sync with the source of truth.
 */
import Dexie, { type EntityTable } from 'dexie';
import { seedCatalogFromHistory, linkItemsToProducts, type CatalogTables } from './catalog';
import type {
  Task, Category, Note,
  LearningCourse, LearningGoal,
  ShoppingList, ShoppingItem, ShoppingHistoryEntry, ShoppingRecipe,
  ShoppingCategory, PantryItem, Store, StoreCategory, Product, Purchase,
  BudgetCategory, BudgetIncome, BudgetBill, BudgetExpense,
  SettingRow, MetaRow,
} from './types';

/**
 * The version-1 table definitions, kept as data so the upgrade to version 2 can
 * be tested against a database that really was created at version 1.
 */
export const SCHEMA_V1 = {
  // Planner
  tasks: 'id, date, categoryId, createdAt',
  categories: 'id',
  notes: 'id, date',

  // Learning
  learningCourses: 'id, goalId, categoryId',
  learningGoals: 'id',

  // Shopping — items lifted out of the nested list.items array
  shoppingLists: 'id, createdAt',
  shoppingItems: 'id, listId, category, [listId+category]',
  shoppingHistory: 'name, barcode, lastBought',
  shoppingRecipes: 'id',
  shoppingCategories: 'id',
  pantry: 'id, name, category',

  // Budget
  budgetCategories: 'id, type',
  budgetIncome: 'id',
  budgetBills: 'id, dueDay',
  budgetExpenses: 'id, categoryId, date, [categoryId+date]',

  // Singletons & bookkeeping
  settings: 'key',
  meta: 'key',
};

export class HeroDayDB extends Dexie {
  tasks!: EntityTable<Task, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  notes!: EntityTable<Note, 'id'>;

  learningCourses!: EntityTable<LearningCourse, 'id'>;
  learningGoals!: EntityTable<LearningGoal, 'id'>;

  shoppingLists!: EntityTable<ShoppingList, 'id'>;
  shoppingItems!: EntityTable<ShoppingItem, 'id'>;
  shoppingHistory!: EntityTable<ShoppingHistoryEntry, 'name'>;
  shoppingRecipes!: EntityTable<ShoppingRecipe, 'id'>;
  shoppingCategories!: EntityTable<ShoppingCategory, 'id'>;
  pantry!: EntityTable<PantryItem, 'id'>;
  stores!: EntityTable<Store, 'id'>;
  storeCategories!: EntityTable<StoreCategory, 'id'>;
  products!: EntityTable<Product, 'id'>;
  purchases!: EntityTable<Purchase, 'id'>;

  budgetCategories!: EntityTable<BudgetCategory, 'id'>;
  budgetIncome!: EntityTable<BudgetIncome, 'id'>;
  budgetBills!: EntityTable<BudgetBill, 'id'>;
  budgetExpenses!: EntityTable<BudgetExpense, 'id'>;

  settings!: EntityTable<SettingRow, 'key'>;
  meta!: EntityTable<MetaRow, 'key'>;

  constructor(name = 'heroday') {
    super(name);

    this.version(1).stores(SCHEMA_V1);

    // Version 2 adds stores. `storeId` on shoppingLists is deliberately not
    // indexed — IndexedDB drops rows whose indexed value is null, and most
    // lists have no store — so the link is filtered in memory instead.
    this.version(2)
      .stores({
        stores: 'id, categoryId',
        storeCategories: 'id',
      })
      .upgrade(tx =>
        // Existing lists predate the link; give them an explicit "no store" so
        // the stored shape matches the ShoppingList type.
        tx.table('shoppingLists').toCollection().modify(list => {
          if (list.storeId === undefined) list.storeId = null;
        }),
      );

    // Version 3 adds the product catalog and the purchase log. `itemId`,
    // `storeId` and `productId` on rows are nullable and so only sparsely
    // indexed, which is fine: they are looked up for a known key, never scanned.
    this.version(3)
      .stores({
        products: 'id, nameKey, barcode, category',
        purchases: 'id, productId, date, storeId, itemId, [productId+date]',
      })
      .upgrade(async tx => {
        // Items gain an explicit "no product yet" before being linked.
        await tx.table('shoppingItems').toCollection().modify(item => {
          if (item.productId === undefined) item.productId = null;
        });

        // Turn the old per-name history into products, then link every list
        // item to one. Inside the upgrade transaction, so it lands with the
        // schema change or not at all.
        const tables: CatalogTables = {
          history: tx.table('shoppingHistory'),
          items: tx.table('shoppingItems'),
          products: tx.table('products'),
          purchases: tx.table('purchases'),
        };
        await seedCatalogFromHistory(tables);
        await linkItemsToProducts(tables);
      });
  }
}

/**
 * The app-wide database handle.
 *
 * Tests construct their own `HeroDayDB` against fake-indexeddb rather than
 * importing this one, so the singleton is safe to create at module load.
 */
export const db = new HeroDayDB();
