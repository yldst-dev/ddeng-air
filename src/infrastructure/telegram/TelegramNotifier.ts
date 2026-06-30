import type { Notifier } from '../../domain/ports/Notifier.js';
import type { ListingChange } from '../../domain/entities/ListingChange.js';
import type { SentMessageStore } from '../../domain/ports/SentMessageStore.js';
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
    private readonly store: SentMessageStore,
    private readonly logger: Logger,
  ) {
    this.allowed = new Set(options.allowedChatIds);
  }

  async notify(change: ListingChange): Promise<void> {
    if (change.kind === 'SOLD_OUT') {
      await this.notifyClosed(change);
    } else if (change.kind === 'NEW') {
      await this.notifyNew(change);
    } else {
      await this.notifyUpdate(change);
    }
  }

  private async notifyNew(change: ListingChange): Promise<void> {
    const { text, bookingUrl } = formatChange(change);
    const replyMarkup = bookingMarkup(bookingUrl);
    const silent = this.isSilent(change);

    for (const chatId of this.allowed) {
      const messageId = await this.sendMessage(chatId, text, replyMarkup, silent);
      if (messageId !== null) {
        this.store.save(change.listing.fareKey, chatId, messageId);
      }
      await this.throttle();
    }
  }

  private async notifyUpdate(change: ListingChange): Promise<void> {
    const { text, bookingUrl } = formatChange(change);
    const replyMarkup = bookingMarkup(bookingUrl);
    const silent = this.isSilent(change);
    const byChat = new Map(
      this.store.findByFareKey(change.listing.fareKey).map((m) => [m.chatId, m.messageId]),
    );

    for (const chatId of this.allowed) {
      const messageId = byChat.get(chatId);
      const edited =
        messageId !== undefined && (await this.editMessage(chatId, messageId, text, replyMarkup));
      if (!edited) {
        const newId = await this.sendMessage(chatId, text, replyMarkup, silent);
        if (newId !== null) {
          this.store.save(change.listing.fareKey, chatId, newId);
        }
      }
      await this.throttle();
    }
  }

  private async notifyClosed(change: ListingChange): Promise<void> {
    const stored = this.store.findByFareKey(change.listing.fareKey);
    for (const { chatId, messageId } of stored) {
      await this.deleteMessage(chatId, messageId);
      await this.throttle();
    }
    this.store.deleteByFareKey(change.listing.fareKey);
  }

  private isSilent(change: ListingChange): boolean {
    return change.listing.price > this.options.loudMaxPrice;
  }

  private async sendMessage(
    chatId: string,
    text: string,
    replyMarkup: unknown,
    silent: boolean,
  ): Promise<number | null> {
    if (this.options.dryRun) {
      this.logger.info(`[DRY_RUN]${silent ? '(무음)' : '(알림)'} send -> ${chatId}\n${text}`);
      return null;
    }

    const res = await fetch(`https://api.telegram.org/bot${this.options.botToken}/sendMessage`, {
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

    const json = (await res.json()) as { result?: { message_id?: number } };
    return json.result?.message_id ?? null;
  }

  private async editMessage(
    chatId: string,
    messageId: number,
    text: string,
    replyMarkup: unknown,
  ): Promise<boolean> {
    if (this.options.dryRun) {
      this.logger.info(`[DRY_RUN] edit -> ${chatId}#${messageId}\n${text}`);
      return true;
    }

    const res = await fetch(`https://api.telegram.org/bot${this.options.botToken}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      this.logger.error(`메시지 수정 실패 (chat ${chatId}#${messageId}), 새 메시지로 대체`, detail);
      return false;
    }
    return true;
  }

  private async deleteMessage(chatId: string, messageId: number): Promise<void> {
    if (this.options.dryRun) {
      this.logger.info(`[DRY_RUN] delete -> ${chatId}#${messageId}`);
      return;
    }

    const res = await fetch(`https://api.telegram.org/bot${this.options.botToken}/deleteMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      this.logger.error(`메시지 삭제 실패 (chat ${chatId}#${messageId})`, detail);
    }
  }

  private async throttle(): Promise<void> {
    if (this.options.sendIntervalMs > 0) {
      await sleep(this.options.sendIntervalMs);
    }
  }
}

function bookingMarkup(url: string): unknown {
  return { inline_keyboard: [[{ text: '예약하러 가기', url }]] };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
