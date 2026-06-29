import type { SearchCriteria } from '../domain/ports/FlightSource.js';
import { SyncListingsUseCase } from '../application/SyncListingsUseCase.js';
import { loadConfig, type AppConfig } from '../infrastructure/config/AppConfig.js';
import { TtangFlightSource } from '../infrastructure/source/TtangFlightSource.js';
import { SqliteListingRepository } from '../infrastructure/persistence/SqliteListingRepository.js';
import { TelegramNotifier } from '../infrastructure/telegram/TelegramNotifier.js';
import { ConsoleLogger } from '../infrastructure/logging/ConsoleLogger.js';
import { SystemClock, formatYmd, addDays } from '../infrastructure/time/SystemClock.js';

export interface Container {
  readonly config: AppConfig;
  readonly useCase: SyncListingsUseCase;
  readonly repository: SqliteListingRepository;
  buildCriteria(): SearchCriteria;
}

export function createContainer(): Container {
  const config = loadConfig();
  const logger = new ConsoleLogger();
  const clock = new SystemClock();

  const source = new TtangFlightSource();
  const repository = new SqliteListingRepository(config.databasePath);
  const notifier = new TelegramNotifier(config.telegram, repository, logger);

  const useCase = new SyncListingsUseCase(
    source,
    repository,
    notifier,
    clock,
    config.policy,
    logger,
    config.telegram.dryRun,
  );

  return {
    config,
    useCase,
    repository,
    buildCriteria(): SearchCriteria {
      const today = clock.today();
      return {
        trip: config.search.trip,
        gubun: config.search.gubun,
        depDateFrom: formatYmd(today),
        depDateTo: formatYmd(addDays(today, config.search.departWithinDays)),
        adt: config.search.adt,
      };
    },
  };
}
