import cron from 'node-cron';
import { createContainer } from './container.js';
import { ConsoleLogger } from '../infrastructure/logging/ConsoleLogger.js';

async function runCycle(): Promise<void> {
  const logger = new ConsoleLogger();
  const container = createContainer();
  try {
    const criteria = container.buildCriteria();
    logger.info(
      `수집 시작: ${criteria.trip}/${criteria.gubun} ${criteria.depDateFrom}~${criteria.depDateTo}`,
    );
    const summary = await container.useCase.execute(criteria);
    logger.info(
      `완료: 수집 ${summary.fetched}건 / 발송 ${summary.notified}건 ` +
        `(신규 ${summary.counts.NEW}, 하락 ${summary.counts.PRICE_DOWN}, ` +
        `상승 ${summary.counts.PRICE_UP}, 마감 ${summary.counts.SOLD_OUT})`,
    );
  } catch (error) {
    logger.error('수집 주기 실행 실패', error);
  } finally {
    container.repository.close();
  }
}

async function main(): Promise<void> {
  const logger = new ConsoleLogger();
  const container = createContainer();
  const schedule = container.config.cronSchedule;
  const timezone = container.config.timezone;
  const runOnStart = container.config.runOnStart;
  container.repository.close();

  if (!cron.validate(schedule)) {
    throw new Error(`잘못된 CRON_SCHEDULE: ${schedule}`);
  }

  if (runOnStart) {
    logger.info('RUN_ON_START=true: 시작 즉시 1회 실행합니다.');
    await runCycle();
  }

  cron.schedule(schedule, () => void runCycle(), { timezone });
  logger.info(`스케줄러 시작: "${schedule}" (${timezone}). 다음 주기를 대기합니다.`);
}

void main();
