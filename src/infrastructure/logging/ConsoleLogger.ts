import type { Logger } from '../../application/SyncListingsUseCase.js';

export class ConsoleLogger implements Logger {
  info(message: string): void {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }

  error(message: string, error?: unknown): void {
    const detail = error instanceof Error ? error.message : error ? String(error) : '';
    console.error(`[${new Date().toISOString()}] ${message}${detail ? ` :: ${detail}` : ''}`);
  }
}
