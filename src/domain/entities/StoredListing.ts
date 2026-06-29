import type { Listing } from './Listing.js';

export type ListingStatus = 'active' | 'closed';

export interface StoredListing extends Listing {
  readonly status: ListingStatus;
  readonly lastSentPrice: number;
  readonly firstSeen: string;
  readonly lastSeen: string;
}
