import type { ListingChange } from '../entities/ListingChange.js';

export interface Notifier {
  notify(change: ListingChange): Promise<void>;
}
