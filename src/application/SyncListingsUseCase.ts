import type { FlightSource, SearchCriteria } from '../domain/ports/FlightSource.js';
import type { ListingRepository } from '../domain/ports/ListingRepository.js';
import type { Notifier } from '../domain/ports/Notifier.js';
import type { ChangeKind } from '../domain/entities/ListingChange.js';
import type { Clock } from './Clock.js';
import { diffListings } from './ListingDiffer.js';

export interface NotifyPolicy {
  readonly NEW: boolean;
  readonly PRICE_DOWN: boolean;
  readonly PRICE_UP: boolean;
  readonly SOLD_OUT: boolean;
}

export interface SyncSummary {
  readonly fetched: number;
  readonly notified: number;
  readonly counts: Record<ChangeKind, number>;
}

export interface Logger {
  info(message: string): void;
  error(message: string, error?: unknown): void;
}

export class SyncListingsUseCase {
  constructor(
    private readonly source: FlightSource,
    private readonly repository: ListingRepository,
    private readonly notifier: Notifier,
    private readonly clock: Clock,
    private readonly policy: NotifyPolicy,
    private readonly logger: Logger,
  ) {}

  async execute(criteria: SearchCriteria): Promise<SyncSummary> {
    const current = await this.source.fetchCurrent(criteria);
    const active = this.repository.loadActive();
    const { changes, plan } = diffListings(current, active);

    const counts: Record<ChangeKind, number> = {
      NEW: 0,
      PRICE_DOWN: 0,
      PRICE_UP: 0,
      SOLD_OUT: 0,
    };
    let notified = 0;

    for (const change of changes) {
      counts[change.kind] += 1;
      if (!this.policy[change.kind]) continue;
      try {
        await this.notifier.notify(change);
        notified += 1;
      } catch (error) {
        this.logger.error(`발송 실패 (${change.kind} ${change.listing.fareKey})`, error);
      }
    }

    this.repository.applySync(plan, this.clock.nowIso());

    return { fetched: current.length, notified, counts };
  }
}
