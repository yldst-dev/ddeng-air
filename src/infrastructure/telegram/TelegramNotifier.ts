import type { Notifier } from '../../domain/ports/Notifier.js';
import type { ListingChange } from '../../domain/entities/ListingChange.js';
import type { Logger } from '../../application/SyncListingsUseCase.js';
import { formatChange } from './messageFormatter.js';

export interface TelegramOptions {
  readonly botToken: string;
  readonly allowedChatIds: readonly string[];
  readonly sendIntervalMs: number;
  readonly dryRun: boolean;
  readonly loudMaxPrice: number;
}

export class TelegramNotifier implements Notifier {
  private readonly allowed: ReadonlySet<string>;

  constructor(
    private readonly options: TelegramOptions,
    private readonly logger: Logger,
  ) {
    this.allowed = new Set(options.allowedChatIds);
  }

  async notify(change: ListingChange): Promise<void> {
    const { text, bookingUrl } = formatChange(change);
    const replyMarkup =
      change.kind === 'SOLD_OUT'
        ? undefined
        : { inline_keyboard: [[{ text: '예약하러 가기', url: bookingUrl }]] };

    const silent = change.listing.price > this.options.loudMaxPrice;

    for (const chatId of this.allowed) {
      await this.send(chatId, text, replyMarkup, silent);
      if (this.options.sendIntervalMs > 0) {
        await sleep(this.options.sendIntervalMs);
      }
    }
  }

  private async send(
    chatId: string,
    text: string,
    replyMarkup: unknown,
    silent: boolean,
  ): Promise<void> {
    if (this.options.dryRun) {
      this.logger.info(`[DRY_RUN]${silent ? '(무음)' : '(알림)'} -> ${chatId}\n${text}`);
      return;
    }

    const url = `https://api.telegram.org/bot${this.options.botToken}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        disable_notification: silent,
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`텔레그램 발송 실패 (chat ${chatId}): HTTP ${res.status} ${detail}`);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
