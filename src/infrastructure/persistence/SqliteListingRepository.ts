import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import type { Listing } from '../../domain/entities/Listing.js';
import type { StoredListing, ListingStatus } from '../../domain/entities/StoredListing.js';
import type { ListingRepository, SyncPlan } from '../../domain/ports/ListingRepository.js';
import type { SentMessage, SentMessageStore } from '../../domain/ports/SentMessageStore.js';

interface Row {
  fare_key: string;
  trip: string;
  gubun: string;
  airline: string;
  airline_code: string;
  dep_code: string;
  dep_name: string;
  arr_code: string;
  arr_name: string;
  dep_date: string;
  arr_date: string;
  trip_day: string;
  minimum_cnt: number;
  price: number;
  last_sent_price: number;
  status: ListingStatus;
  first_seen: string;
  last_seen: string;
  payload: string;
}

export class SqliteListingRepository implements ListingRepository, SentMessageStore {
  private readonly db: Database.Database;

  constructor(databasePath: string) {
    mkdirSync(dirname(databasePath), { recursive: true });
    this.db = new Database(databasePath);
    this.db.pragma('journal_mode = WAL');
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS listings (
        fare_key TEXT PRIMARY KEY,
        trip TEXT NOT NULL,
        gubun TEXT NOT NULL,
        airline TEXT NOT NULL,
        airline_code TEXT NOT NULL,
        dep_code TEXT NOT NULL,
        dep_name TEXT NOT NULL,
        arr_code TEXT NOT NULL,
        arr_name TEXT NOT NULL,
        dep_date TEXT NOT NULL,
        arr_date TEXT NOT NULL,
        trip_day TEXT NOT NULL,
        minimum_cnt INTEGER NOT NULL,
        price INTEGER NOT NULL,
        last_sent_price INTEGER NOT NULL,
        status TEXT NOT NULL,
        first_seen TEXT NOT NULL,
        last_seen TEXT NOT NULL,
        payload TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS price_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fare_key TEXT NOT NULL,
        price INTEGER NOT NULL,
        observed_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sent_messages (
        fare_key TEXT NOT NULL,
        chat_id TEXT NOT NULL,
        message_id INTEGER NOT NULL,
        PRIMARY KEY (fare_key, chat_id)
      );

      CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
      CREATE INDEX IF NOT EXISTS idx_history_key ON price_history(fare_key);
    `);
  }

  save(fareKey: string, chatId: string, messageId: number): void {
    this.db
      .prepare(
        `INSERT INTO sent_messages (fare_key, chat_id, message_id)
         VALUES (?, ?, ?)
         ON CONFLICT(fare_key, chat_id) DO UPDATE SET message_id = excluded.message_id`,
      )
      .run(fareKey, chatId, messageId);
  }

  findByFareKey(fareKey: string): SentMessage[] {
    const rows = this.db
      .prepare(`SELECT chat_id, message_id FROM sent_messages WHERE fare_key = ?`)
      .all(fareKey) as { chat_id: string; message_id: number }[];
    return rows.map((r) => ({ chatId: r.chat_id, messageId: r.message_id }));
  }

  deleteByFareKey(fareKey: string): void {
    this.db.prepare(`DELETE FROM sent_messages WHERE fare_key = ?`).run(fareKey);
  }

  loadActive(): StoredListing[] {
    const rows = this.db
      .prepare(`SELECT * FROM listings WHERE status = 'active'`)
      .all() as Row[];
    return rows.map(toEntity);
  }

  applySync(plan: SyncPlan, nowIso: string): void {
    const upsertActive = this.db.prepare(`
      INSERT INTO listings (
        fare_key, trip, gubun, airline, airline_code,
        dep_code, dep_name, arr_code, arr_name,
        dep_date, arr_date, trip_day, minimum_cnt,
        price, last_sent_price, status, first_seen, last_seen, payload
      ) VALUES (
        @fare_key, @trip, @gubun, @airline, @airline_code,
        @dep_code, @dep_name, @arr_code, @arr_name,
        @dep_date, @arr_date, @trip_day, @minimum_cnt,
        @price, @last_sent_price, 'active', @now, @now, @payload
      )
      ON CONFLICT(fare_key) DO UPDATE SET
        price = excluded.price,
        last_sent_price = CASE WHEN @bump_sent = 1 THEN excluded.price ELSE listings.last_sent_price END,
        status = 'active',
        last_seen = excluded.last_seen,
        payload = excluded.payload
    `);

    const close = this.db.prepare(`
      UPDATE listings
      SET status = 'closed', last_seen = @now
      WHERE fare_key = @fare_key
    `);

    const history = this.db.prepare(`
      INSERT INTO price_history (fare_key, price, observed_at)
      VALUES (@fare_key, @price, @now)
    `);

    const run = this.db.transaction(() => {
      for (const listing of plan.insert) {
        upsertActive.run(toParams(listing, nowIso, true));
        history.run({ fare_key: listing.fareKey, price: listing.price, now: nowIso });
      }
      for (const listing of plan.updatePrice) {
        upsertActive.run(toParams(listing, nowIso, true));
        history.run({ fare_key: listing.fareKey, price: listing.price, now: nowIso });
      }
      for (const listing of plan.touch) {
        upsertActive.run(toParams(listing, nowIso, false));
      }
      for (const stored of plan.close) {
        close.run({ fare_key: stored.fareKey, now: nowIso });
      }
    });

    run();
  }

  close(): void {
    this.db.close();
  }
}

function toParams(listing: Listing, now: string, bumpSent: boolean) {
  return {
    fare_key: listing.fareKey,
    trip: listing.trip,
    gubun: listing.gubun,
    airline: listing.airline,
    airline_code: listing.airlineCode,
    dep_code: listing.depCode,
    dep_name: listing.depName,
    arr_code: listing.arrCode,
    arr_name: listing.arrName,
    dep_date: listing.depDate,
    arr_date: listing.arrDate,
    trip_day: listing.tripDay,
    minimum_cnt: listing.minimumCnt,
    price: listing.price,
    last_sent_price: listing.price,
    last_seen: now,
    payload: listing.payload,
    now,
    bump_sent: bumpSent ? 1 : 0,
  };
}

function toEntity(row: Row): StoredListing {
  return {
    fareKey: row.fare_key,
    trip: row.trip,
    gubun: row.gubun,
    airline: row.airline,
    airlineCode: row.airline_code,
    depCode: row.dep_code,
    depName: row.dep_name,
    arrCode: row.arr_code,
    arrName: row.arr_name,
    depDate: row.dep_date,
    arrDate: row.arr_date,
    tripDay: row.trip_day,
    minimumCnt: row.minimum_cnt,
    price: row.price,
    payload: row.payload,
    status: row.status,
    lastSentPrice: row.last_sent_price,
    firstSeen: row.first_seen,
    lastSeen: row.last_seen,
  };
}
