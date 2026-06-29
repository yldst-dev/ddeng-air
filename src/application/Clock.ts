export interface Clock {
  nowIso(): string;
  today(): Date;
}
