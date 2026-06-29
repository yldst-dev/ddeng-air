export interface Listing {
  readonly fareKey: string;
  readonly trip: string;
  readonly gubun: string;
  readonly airline: string;
  readonly airlineCode: string;
  readonly depCode: string;
  readonly depName: string;
  readonly arrCode: string;
  readonly arrName: string;
  readonly depDate: string;
  readonly arrDate: string;
  readonly tripDay: string;
  readonly minimumCnt: number;
  readonly price: number;
  readonly payload: string;
}

export function buildFareKey(parts: {
  trip: string;
  gubun: string;
  airlineCode: string;
  depCode: string;
  arrCode: string;
  depDate: string;
  arrDate: string;
}): string {
  return [
    parts.trip,
    parts.gubun,
    parts.airlineCode,
    parts.depCode,
    parts.arrCode,
    parts.depDate,
    parts.arrDate,
  ].join('|');
}
