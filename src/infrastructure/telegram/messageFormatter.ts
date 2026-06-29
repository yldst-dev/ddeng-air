import type { Listing } from '../../domain/entities/Listing.js';
import type { ListingChange } from '../../domain/entities/ListingChange.js';

export interface FormattedMessage {
  readonly text: string;
  readonly bookingUrl: string;
}

const WON = new Intl.NumberFormat('ko-KR');

export function formatChange(change: ListingChange): FormattedMessage {
  const l = change.listing;
  const route = `${esc(l.depName)}(${esc(l.depCode)}) → ${esc(l.arrName)}(${esc(l.arrCode)})`;
  const meta = `${esc(l.airline)} · ${tripLabel(l.trip)} · ${esc(l.tripDay)}`;
  const schedule = `출발 ${ymd(l.depDate)} · 귀국 ${ymd(l.arrDate)}`;
  const seat = l.minimumCnt > 1 ? `\n${l.minimumCnt}명 이상 예약 가능` : '';

  let text: string;
  switch (change.kind) {
    case 'NEW':
      text =
        `<b>[신규] ${route}</b>\n${meta}\n${schedule}\n` +
        `<b>${won(l.price)}</b>${seat}`;
      break;
    case 'PRICE_DOWN':
      text =
        `<b>[가격하락] ${route}</b>\n${meta}\n${schedule}\n` +
        `<s>${won(change.previousPrice ?? l.price)}</s> → <b>${won(l.price)}</b>` +
        ` (${won(Math.abs((change.previousPrice ?? l.price) - l.price))} ↓)${seat}`;
      break;
    case 'PRICE_UP':
      text =
        `<b>[가격상승] ${route}</b>\n${meta}\n${schedule}\n` +
        `<s>${won(change.previousPrice ?? l.price)}</s> → <b>${won(l.price)}</b>` +
        ` (${won(Math.abs(l.price - (change.previousPrice ?? l.price)))} ↑)${seat}`;
      break;
    case 'SOLD_OUT':
      text =
        `<b>[마감]</b> <s>${route}</s>\n<s>${meta}</s>\n<s>${schedule}</s>\n` +
        `<s>${won(l.price)}</s>\n판매가 마감되었습니다.`;
      break;
  }

  return { text, bookingUrl: bookingUrl(l) };
}

function tripLabel(trip: string): string {
  return trip === 'OW' ? '편도' : '왕복';
}

function won(value: number): string {
  return `${WON.format(value)}원`;
}

function ymd(value: string): string {
  if (value.length !== 8) return esc(value);
  return `${value.slice(0, 4)}.${value.slice(4, 6)}.${value.slice(6, 8)}`;
}

function bookingUrl(l: Listing): string {
  return (
    `https://mm.ttang.com/ttangair/search/discount/limit.do` +
    `?trip=${encodeURIComponent(l.trip)}&gubun=${encodeURIComponent(l.gubun)}` +
    `&depdate0=${ymdDash(l.depDate)}&depdate1=${ymdDash(l.arrDate)}`
  );
}

function ymdDash(value: string): string {
  if (value.length !== 8) return value;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
