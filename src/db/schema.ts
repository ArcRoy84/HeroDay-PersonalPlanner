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
import type {
  Task, Category, Note,
  LearningCourse, LearningGoal,
  ShoppingList, ShoppingItem, ShoppingHistoryEntry, ShoppingRecipe,
  ShoppingCategory, PantryItem,
  BudgetCategory, BudgetIncome, BudgetBill, BudgetExpense,
  SettingRow, MetaRow,
} from './types';

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

  budgetCategories!: EntityTable<BudgetCategory, 'id'>;
  budgetIncome!: EntityTable<BudgetIncome, 'id'>;
  budgetBills!: EntityTable<BudgetBill, 'id'>;
  budgetExpenses!: EntityTable<BudgetExpense, 'id'>;

  settings!: EntityTable<SettingRow, 'key'>;
  meta!: EntityTable<MetaRow, 'key'>;

  constructor(name = 'heroday') {
    super(name);

    this.version(1).stores({
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
