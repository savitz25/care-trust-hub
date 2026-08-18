import "server-only";
import { createHash } from "node:crypto";
import type { QueryResultRow } from "pg";
import { getCareDatabasePool } from "@/server/care/db";
import {
  googlePlacesFieldMasks,
  type GooglePlacesCache,
  type GooglePlacesOperation,
} from "./google-places";

interface CacheRow extends QueryResultRow {
  response_payload: unknown;
}

type Queryable = {
  query<T extends QueryResultRow>(text: string, values: unknown[]): Promise<{ rows: T[] }>;
};

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export class PostgresGooglePlacesCache implements GooglePlacesCache {
  constructor(
    private readonly database: Queryable = getCareDatabasePool(),
    private readonly intelligenceRunId?: string,
  ) {}

  async get(operation: GooglePlacesOperation, cacheKey: string): Promise<unknown | null> {
    const result = await this.database.query<CacheRow>(
      `SELECT response_payload FROM facility_external_request_cache
       WHERE source_type='google_places' AND operation=$1 AND cache_key=$2
         AND field_mask=$3 AND adapter_version='google-places-v1' AND expires_at>now()
       LIMIT 1`,
      [operation, cacheKey, googlePlacesFieldMasks[operation]],
    );
    return result.rows[0]?.response_payload ?? null;
  }

  async set(
    operation: GooglePlacesOperation,
    cacheKey: string,
    value: unknown,
    expiresAt: Date,
  ): Promise<void> {
    const serialized = JSON.stringify(value);
    await this.database.query(
      `INSERT INTO facility_external_request_cache
        (source_type,operation,cache_key,request_fingerprint,response_fingerprint,
         response_payload,field_mask,retrieved_at,expires_at,adapter_version,intelligence_run_id)
       VALUES ('google_places',$1,$2,$3,$4,$5,$6,now(),$7,'google-places-v1',$8)
       ON CONFLICT (source_type,operation,cache_key,field_mask,adapter_version)
       DO UPDATE SET response_fingerprint=EXCLUDED.response_fingerprint,
         response_payload=EXCLUDED.response_payload,retrieved_at=EXCLUDED.retrieved_at,
         expires_at=EXCLUDED.expires_at,intelligence_run_id=EXCLUDED.intelligence_run_id`,
      [
        operation,
        cacheKey,
        sha256(`${operation}|${cacheKey}|${googlePlacesFieldMasks[operation]}`),
        sha256(serialized),
        value,
        googlePlacesFieldMasks[operation],
        expiresAt,
        this.intelligenceRunId ?? null,
      ],
    );
  }
}
