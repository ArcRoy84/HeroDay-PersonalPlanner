// Barcode lookup for the UI: Open Food Facts details plus the product photo.
import { lookupBarcode } from '../../utils/openFoodFacts';
import { resizeImage } from './parsing.js';
import { categorize } from '../../data/shoppingCategories.js';

// Product photos are shown small; 320px is sharp on a 2x display without
// bloating the database or a backup.
const PHOTO_MAX_PX = 320;
// A front-of-pack thumbnail is tens of KB. Anything far beyond that is not one.
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

async function downloadPhoto(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Photo download failed (${response.status})`);
  const blob = await response.blob();
  if (!blob.type.startsWith('image/') || blob.size > PHOTO_MAX_BYTES) {
    throw new Error('Not a usable image');
  }
  // Stored as a small JPEG data URL, so nothing is hotlinked: the app never asks
  // Open Food Facts for the picture again, and it survives in a JSON backup.
  return resizeImage(blob, PHOTO_MAX_PX, 0.85);
}

/**
 * Looks a barcode up and returns what the item form can fill in, or `null` if
 * Open Food Facts does not know it. Throws if the lookup itself fails.
 *
 * The photo is best-effort: if it cannot be fetched (offline, blocked, not an
 * image) everything else is still returned and `photoFailed` says so.
 */
export async function lookupProduct(barcode) {
  const found = await lookupBarcode(barcode);
  if (!found) return null;

  let photo = null;
  let photoFailed = false;
  if (found.imageUrl) {
    try {
      photo = await downloadPhoto(found.imageUrl);
    } catch {
      photoFailed = true;
    }
  }

  // A category is guessed from the name; "other" means no guess, so the form's
  // own default stays.
  const guessed = categorize(found.name);
  return {
    name: found.name,
    brand: found.brand,
    packageSize: found.packageSize,
    category: guessed === 'other' ? null : guessed,
    photo,
    photoFailed,
  };
}
