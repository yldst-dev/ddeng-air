import type { FlightSource, SearchCriteria } from '../../domain/ports/FlightSource.js';
import { type Listing, buildFareKey } from '../../domain/entities/Listing.js';

const ENDPOINT = 'https://mm.ttang.com/ttangair/search/discount/listAct.do';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';

interface RawFare {
  readonly tktCar: string;
  readonly tktCarDesc: string;
  readonly depCityCode: string;
  readonly depCityDesc: string;
  readonly arrCityCode: string;
  readonly arrCityDesc: string;
  readonly departureDate: string;
  readonly arrivalDate: string;
  readonly tripDay: string;
  readonly minimumCnt: number;
  readonly totalPrice: number;
}

interface RawEnvelope {
  readonly code: string;
  readonly desc: string;
  readonly response: readonly RawFare[];
}

export class TtangFlightSource implements FlightSource {
  async fetchCurrent(criteria: SearchCriteria): Promise<Listing[]> {
    const body = new URLSearchParams({
      trip: criteria.trip,
      dep0: '',
      arr0: '',
      dep1: '',
      arr1: '',
      dep2: '',
      arr2: '',
      depdate0: criteria.depDateFrom,
      depdate1: criteria.depDateTo,
      depdate2: '',
      adt: String(criteria.adt),
      chd: '0',
      inf: '0',
      comp: '',
      car: '',
      groupId: '',
      pflAffId: '',
      pflAfsId: '',
      gubun: criteria.gubun,
      seq: '',
      requestData: '',
      page: '1',
      scale: '500',
      totalCnt: '0',
    });

    const referer =
      `https://mm.ttang.com/ttangair/search/discount/limit.do` +
      `?trip=${criteria.trip}&gubun=${criteria.gubun}` +
      `&depdate0=${criteria.depDateFrom}&depdate1=${criteria.depDateTo}`;

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: referer,
        'User-Agent': USER_AGENT,
      },
      body: body.toString(),
    });

    if (!res.ok) {
      throw new Error(`땡처리 API 응답 오류: HTTP ${res.status}`);
    }

    const text = await res.text();
    const envelope = parseEnvelope(text);

    const listings = envelope.response.map((raw) => toListing(raw, criteria));
    return dedupeCheapest(listings);
  }
}

function dedupeCheapest(listings: readonly Listing[]): Listing[] {
  const byKey = new Map<string, Listing>();
  for (const listing of listings) {
    const existing = byKey.get(listing.fareKey);
    if (!existing || listing.price < existing.price) {
      byKey.set(listing.fareKey, listing);
    }
  }
  return [...byKey.values()];
}

function parseEnvelope(xml: string): RawEnvelope {
  const match = /<!\[CDATA\[([\s\S]*?)\]\]>/.exec(xml);
  if (!match || match[1] === undefined) {
    throw new Error('땡처리 API 응답에서 데이터(CDATA)를 찾지 못했습니다.');
  }
  const parsed = JSON.parse(match[1]) as RawEnvelope;
  if (parsed.code !== 'OK' || !Array.isArray(parsed.response)) {
    throw new Error(`땡처리 API 비정상 응답: code=${parsed.code}`);
  }
  return parsed;
}

function toListing(raw: RawFare, criteria: SearchCriteria): Listing {
  return {
    fareKey: buildFareKey({
      trip: criteria.trip,
      gubun: criteria.gubun,
      airlineCode: raw.tktCar,
      depCode: raw.depCityCode,
      arrCode: raw.arrCityCode,
      depDate: raw.departureDate,
      arrDate: raw.arrivalDate,
    }),
    trip: criteria.trip,
    gubun: criteria.gubun,
    airline: raw.tktCarDesc,
    airlineCode: raw.tktCar,
    depCode: raw.depCityCode,
    depName: raw.depCityDesc,
    arrCode: raw.arrCityCode,
    arrName: raw.arrCityDesc,
    depDate: raw.departureDate,
    arrDate: raw.arrivalDate,
    tripDay: raw.tripDay,
    minimumCnt: raw.minimumCnt,
    price: raw.totalPrice,
    payload: JSON.stringify(raw),
  };
}
