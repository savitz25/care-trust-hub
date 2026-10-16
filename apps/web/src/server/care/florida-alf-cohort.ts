import "server-only";
import {
  attachFloridaAlfCounties,
  buildFloridaPublishedAlfCohort,
  type FloridaPublishedAlfRecord,
} from "@care/domain";
import manifest from "@/data/florida-provider-publication.json";
import publicationQa from "../../../../../docs/fl-sen-007-publication-cohort.json";
import { getCareDatabasePool } from "./db";

export function floridaPublishedAlfRecords(): FloridaPublishedAlfRecord[] {
  return buildFloridaPublishedAlfCohort(
    manifest.profiles.map((row) => ({
      providerId: row.provider_id,
      providerClass: row.provider_class,
      profileKind: row.profile_kind,
      ahcaFileNumber: row.ahca_file_number,
      futurePath: row.future_path,
    })),
    publicationQa.qa.map((row) => ({
      providerId: row.provider_id,
      kind: row.kind,
      file: row.file,
      path: row.path,
      name: row.name,
    })),
  );
}

export async function loadFloridaPublishedAlf(): Promise<{
  records: FloridaPublishedAlfRecord[];
  countyFilterAvailable: boolean;
}> {
  const records = floridaPublishedAlfRecords();
  try {
    const result = await getCareDatabasePool().query<{
      provider_id: string;
      geography: unknown;
    }>(
      `select provider_id::text as provider_id, payload->'geography' as geography
         from state_provider_profile
        where provider_id = any($1::uuid[])`,
      [records.map((record) => record.providerId)],
    );
    return {
      records: attachFloridaAlfCounties(
        records,
        result.rows.map((row) => ({
          providerId: row.provider_id,
          geography: row.geography,
        })),
      ),
      countyFilterAvailable: true,
    };
  } catch {
    console.warn(JSON.stringify({ event: "florida_alf_county_unavailable" }));
    return { records, countyFilterAvailable: false };
  }
}
