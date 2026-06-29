import type { Listing } from './Listing.js';

export type ChangeKind = 'NEW' | 'PRICE_DOWN' | 'PRICE_UP' | 'SOLD_OUT';

export interface ListingChange {
  readonly kind: ChangeKind;
  readonly listing: Listing;
  readonly previousPrice?: number;
}
