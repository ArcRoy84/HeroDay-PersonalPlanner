/**
 * The product catalog and purchase log, plus the operations the Items section
 * needs.
 *
 * Like `useStores`, the write functions return their promises: the forms have
 * real ways to fail (a duplicate product, an impossible date) and must show the
 * user, not swallow it.
 */
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { isLive } from '../db/repo';
import * as productOps from '../db/productOps';
import * as purchaseOps from '../db/purchaseOps';
import type { Product, Purchase } from '../db/types';

const EMPTY_PRODUCTS: Product[] = [];
const EMPTY_PURCHASES: Purchase[] = [];

export function useProducts() {
  const productRows = useLiveQuery(() => db.products.toArray(), []);
  const purchaseRows = useLiveQuery(() => db.purchases.toArray(), []);

  const products = useMemo(
    () => (productRows
      ? productRows.filter(isLive).sort((a, b) => a.name.localeCompare(b.name))
      : EMPTY_PRODUCTS),
    [productRows],
  );
  const purchases = useMemo(
    () => (purchaseRows ? purchaseRows.filter(isLive) : EMPTY_PURCHASES),
    [purchaseRows],
  );

  return {
    products,
    purchases,
    createProduct: productOps.createProduct,
    updateProduct: productOps.updateProduct,
    removeProduct: productOps.removeProduct,
    addProductToList: productOps.addProductToList,
    logPastPurchase: purchaseOps.logPastPurchase,
    confirmPurchase: purchaseOps.confirmPurchase,
    updatePurchase: purchaseOps.updatePurchase,
    removePurchase: purchaseOps.removePurchase,
  };
}
