import 'dotenv/config';
import type { NotifyPolicy } from '../../application/SyncListingsUseCase.js';

export interface AppConfig {
  readonly telegram: {
    readonly botToken: string;
    readonly allowedChatIds: readonly string[];
    readonly sendIntervalMs: number;
    readonly dryRun: boolean;
    readonly loudMaxPrice: number;
  };
  readonly search: {
    readonly trip: string;
    readonly gubun: string;
    readonly departWithinDays: number;
    readonly adt: number;
  };
  readonly cronSchedule: string;
  readonly runOnStart: boolean;
  readonly timezone: string;
  readonly databasePath: string;
  readonly policy: NotifyPolicy;
}

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    throw new Error(`환경변수 ${name} 가 설정되지 않았습니다. .env 를 확인하십시오.`);
  }
  return value.trim();
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value.trim() === '' ? fallback : value.trim();
}

function bool(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') return fallback;
  return value.trim().toLowerCase() === 'true';
}

function int(name: string, fallback: number): number {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number.parseInt(value.trim(), 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`환경변수 ${name} 는 숫자여야 합니다.`);
  }
  return parsed;
}

export function loadConfig(): AppConfig {
  const allowedChatIds = required('TELEGRAM_ALLOWED_CHAT_IDS')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  if (allowedChatIds.length === 0) {
    throw new Error('TELEGRAM_ALLOWED_CHAT_IDS 에 최소 1개의 채팅 ID 가 필요합니다.');
  }

  return {
    telegram: {
      botToken: required('TELEGRAM_BOT_TOKEN'),
      allowedChatIds,
      sendIntervalMs: int('SEND_INTERVAL_MS', 1200),
      dryRun: bool('DRY_RUN', false),
      loudMaxPrice: int('LOUD_MAX_PRICE', 250000),
    },
    search: {
      trip: optional('TTANG_TRIP', 'RT'),
      gubun: optional('TTANG_GUBUN', 'L'),
      departWithinDays: int('TTANG_DEPART_WITHIN_DAYS', 3),
      adt: int('TTANG_ADT', 1),
    },
    cronSchedule: optional('CRON_SCHEDULE', '0 0,9,12,17,21 * * *'),
    runOnStart: bool('RUN_ON_START', false),
    timezone: optional('TZ', 'Asia/Seoul'),
    databasePath: optional('DATABASE_PATH', './data/listings.db'),
    policy: {
      NEW: bool('NOTIFY_ON_NEW', true),
      PRICE_DOWN: bool('NOTIFY_ON_PRICE_DOWN', true),
      PRICE_UP: bool('NOTIFY_ON_PRICE_UP', true),
      SOLD_OUT: bool('NOTIFY_ON_SOLD_OUT', true),
    },
  };
}
