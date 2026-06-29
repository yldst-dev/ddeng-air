export interface SentMessage {
  readonly chatId: string;
  readonly messageId: number;
}

export interface SentMessageStore {
  save(fareKey: string, chatId: string, messageId: number): void;
  findByFareKey(fareKey: string): SentMessage[];
  deleteByFareKey(fareKey: string): void;
}
