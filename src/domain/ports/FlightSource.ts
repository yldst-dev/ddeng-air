import type { Listing } from '../entities/Listing.js';

export interface SearchCriteria {
  readonly trip: string;
  readonly gubun: string;
  readonly depDateFrom: string;
  readonly depDateTo: string;
  readonly adt: number;
}

export interface FlightSource {
  fetchCurrent(criteria: SearchCriteria): Promise<Listing[]>;
}
