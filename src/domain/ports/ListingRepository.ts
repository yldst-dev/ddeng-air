import type { Listing } from '../entities/Listing.js';
import type { StoredListing } from '../entities/StoredListing.js';

export interface SyncPlan {
  readonly insert: readonly Listing[];
  readonly updatePrice: readonly Listing[];
  readonly touch: readonly Listing[];
  readonly close: readonly StoredListing[];
}

export interface ListingRepository {
  loadActive(): StoredListing[];
  applySync(plan: SyncPlan, nowIso: string): void;
}
