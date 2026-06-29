import { createContainer } from './container.js';
import { ConsoleLogger } from '../infrastructure/logging/ConsoleLogger.js';

async function main(): Promise<void> {
  const logger = new ConsoleLogger();
  const container = createContainer();
  const criteria = container.buildCriteria();

  logger.info(
    `수집 시작: ${criteria.trip}/${criteria.gubun} ${criteria.depDateFrom}~${criteria.depDateTo}`,
  );

  const summary = await container.useCase.execute(criteria);
  container.repository.close();

  logger.info(
    `완료: 수집 ${summary.fetched}건 / 발송 ${summary.notified}건 ` +
      `(신규 ${summary.counts.NEW}, 하락 ${summary.counts.PRICE_DOWN}, ` +
      `상승 ${summary.counts.PRICE_UP}, 마감 ${summary.counts.SOLD_OUT})`,
  );
}

main().catch((error) => {
  const logger = new ConsoleLogger();
  logger.error('실행 중 오류', error);
  process.exitCode = 1;
});
