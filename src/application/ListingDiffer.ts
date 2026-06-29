import type { Listing } from '../domain/entities/Listing.js';
import type { StoredListing } from '../domain/entities/StoredListing.js';
import type { ListingChange } from '../domain/entities/ListingChange.js';
import type { SyncPlan } from '../domain/ports/ListingRepository.js';

export interface DiffResult {
  readonly changes: readonly ListingChange[];
  readonly plan: SyncPlan;
}

export function diffListings(
  current: readonly Listing[],
  activeStored: readonly StoredListing[],
): DiffResult {
  const storedByKey = new Map(activeStored.map((s) => [s.fareKey, s]));
  const currentKeys = new Set(current.map((c) => c.fareKey));

  const changes: ListingChange[] = [];
  const insert: Listing[] = [];
  const updatePrice: Listing[] = [];
  const touch: Listing[] = [];

  for (const listing of current) {
    const prev = storedByKey.get(listing.fareKey);

    if (!prev) {
      changes.push({ kind: 'NEW', listing });
      insert.push(listing);
      continue;
    }

    if (listing.price < prev.lastSentPrice) {
      changes.push({ kind: 'PRICE_DOWN', listing, previousPrice: prev.lastSentPrice });
      updatePrice.push(listing);
    } else if (listing.price > prev.lastSentPrice) {
      changes.push({ kind: 'PRICE_UP', listing, previousPrice: prev.lastSentPrice });
      updatePrice.push(listing);
    } else {
      touch.push(listing);
    }
  }

  const close = activeStored.filter((s) => !currentKeys.has(s.fareKey));
  for (const stored of close) {
    changes.push({ kind: 'SOLD_OUT', listing: stored, previousPrice: stored.price });
  }

  return { changes, plan: { insert, updatePrice, touch, close } };
}
