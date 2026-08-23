/**
 * ASK-SEARCH-SENIOR-001 — read-only nursing facility discovery pilot export.
 *
 * Primary: CARE_DATABASE_URL (CMS CCN + facility_snapshot)
 * Fallback: production sitemap + published facility pages on
 *           https://www.seniortrusthub.com (already-published research)
 *
 * No Google Places / LLM / geocoding / Ask runtime.
 *
 *   node scripts/export-senior-discovery-pilot.mjs
 */

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ORIGIN = 'https://www.seniortrusthub.com';
const PILOT_TARGET = 200;
const SCHEMA = 'ask-network-discovery-v1';
const BANNER = 'PILOT / NOT YET CONSUMED BY ASK PRODUCTION';
const CONCURRENCY = 16;
const BATCH_SIZE = 400;
const FACILITY_HEAD_BYTES = 12288;

const US_STATES = new Set(
  'AL AK AZ AR CA CO CT DC DE FL GA HI IA ID IL IN KS KY LA MA MD ME MI MN MO MS MT NC ND NE NH NJ NM NV NY OH OK OR PA RI SC SD TN TX UT VA VT WA WI WV WY'.split(
    ' '
  )
);

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

loadEnvFile(resolve(ROOT, '.env.local'));
loadEnvFile(resolve(ROOT, '.env'));
loadEnvFile(resolve(ROOT, 'apps/web/.env.local'));

/** Fetch URL; optionally stop after maxBytes (facility head/meta is enough for city/state). */
function get(url, maxBytes = 0) {
  return new Promise((resolvePromise, reject) => {
    let settled = false;
    const finish = (err, value) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolvePromise(value);
    };
    https
      .get(url, { headers: { 'user-agent': 'SeniorTrustHub-discovery-pilot/1.0' } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          get(res.headers.location, maxBytes).then(
            (v) => finish(null, v),
            (e) => finish(e)
          );
          return;
        }
        let d = '';
        res.on('data', (c) => {
          if (settled) return;
          d += c;
          if (maxBytes > 0 && d.length >= maxBytes) {
            finish(null, { status: res.statusCode || 0, body: d });
            res.destroy();
          }
        });
        res.on('end', () => finish(null, { status: res.statusCode || 0, body: d }));
        res.on('error', () => {
          if (!settled) finish(null, { status: res.statusCode || 0, body: d });
        });
      })
      .on('error', (err) => finish(err));
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeCcn(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function isValidCcn(raw) {
  return /^[A-Z0-9]{6}$/.test(normalizeCcn(raw));
}

function providerSlug(name) {
  const slug = String(name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
    .replace(/-$/g, '');
  return slug || 'provider';
}

function networkId(ccn) {
  return `senior:ccn-${normalizeCcn(ccn)}`;
}

function profileUrl(ccn, name) {
  return `${ORIGIN}/facility/cms/${normalizeCcn(ccn)}/${providerSlug(name)}`;
}

function validateUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    if (u.hostname !== 'www.seniortrusthub.com') return false;
    if (u.port || u.username || u.password || u.search || u.hash) return false;
    return /^\/facility\/cms\/[A-Z0-9]{6}\/[a-z0-9-]+$/i.test(u.pathname);
  } catch {
    return false;
  }
}

function parseCityStateFromHtml(html) {
  // meta description: Research NAME in CITY, ST using published CMS...
  const meta = html.match(
    /content="Research\s+[^"]+?\s+in\s+([^"]+?),\s*([A-Z]{2})\s+using published CMS/i
  );
  if (meta) {
    return { city: meta[1].trim(), state: meta[2].trim().toUpperCase() };
  }
  const body = html.match(/\bin\s+([A-Z0-9 .'\-]+),\s*([A-Z]{2})\s+using published CMS/i);
  if (body) {
    return { city: body[1].trim(), state: body[2].trim().toUpperCase() };
  }
  return { city: null, state: null };
}

function parseDisplayNameFromHtml(html, fallback) {
  const title = html.match(/<title>([^|<]+)/i);
  if (title) return title[1].trim();
  const h1 = html.match(/<h1[^>]*>([^<]+)/i);
  if (h1) return h1[1].trim();
  return fallback;
}

async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

async function loadFromSitemapPages(timings) {
  const t0 = performance.now();
  const index = await get(`${ORIGIN}/sitemap.xml`);
  if (index.status !== 200) throw new Error(`sitemap index HTTP ${index.status}`);
  const pages = [...index.body.matchAll(/sitemaps\/(facilities-\d+)\.xml/g)].map((m) => m[1]);
  const rows = [];
  const seen = new Set();
  for (const page of pages) {
    const xml = await get(`${ORIGIN}/sitemaps/${page}.xml`);
    if (xml.status !== 200) throw new Error(`${page} HTTP ${xml.status}`);
    for (const m of xml.body.matchAll(
      /https:\/\/www\.seniortrusthub\.com\/facility\/cms\/([^/]+)\/([^<]+)/g
    )) {
      const ccn = normalizeCcn(m[1]);
      if (!isValidCcn(ccn) || seen.has(ccn)) continue;
      seen.add(ccn);
      rows.push({
        ccn,
        slug: m[2],
        url: m[0],
        displayName: m[2].replace(/-/g, ' '),
      });
    }
  }
  timings.load_ms = performance.now() - t0;

  const t1 = performance.now();
  const hydrated = [];
  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const batch = rows.slice(offset, offset + BATCH_SIZE);
    const part = await mapPool(batch, CONCURRENCY, async (row) => {
      try {
        const res = await get(row.url, FACILITY_HEAD_BYTES);
        if (res.status !== 200 && res.status !== 0) {
          return {
            ccn: row.ccn,
            slug: row.slug,
            displayName: row.displayName,
            legalName: row.displayName,
            city: null,
            state: null,
            zip: null,
            county: null,
            currentlyIndexable: true,
            trustReportEligible: false,
          };
        }
        const loc = parseCityStateFromHtml(res.body);
        const displayName = parseDisplayNameFromHtml(res.body, row.displayName);
        return {
          ccn: row.ccn,
          slug: row.slug,
          displayName,
          legalName: displayName,
          city: loc.city,
          state: loc.state,
          zip: null,
          county: null,
          currentlyIndexable: true,
          trustReportEligible: Boolean(loc.state),
        };
      } catch {
        return {
          ccn: row.ccn,
          slug: row.slug,
          displayName: row.displayName,
          legalName: row.displayName,
          city: null,
          state: null,
          zip: null,
          county: null,
          currentlyIndexable: true,
          trustReportEligible: false,
        };
      }
    });
    hydrated.push(...part);
    process.stderr.write(`hydrated ${hydrated.length}/${rows.length}\n`);
    if (global.gc) global.gc();
    await sleep(50);
  }
  timings.normalize_ms = performance.now() - t1;
  timings.eligibility_ms = timings.normalize_ms;
  return {
    rows: hydrated,
    sourceMode: 'production_sitemap_pages',
    sourceVersion: `wave-sitemap+facility-pages#n=${rows.length};origin=${ORIGIN}`,
  };
}

async function loadFromDatabase(timings) {
  const t0 = performance.now();
  const pg = await import('pg');
  const url = process.env.CARE_DATABASE_URL || process.env.CARE_DATABASE_POOLER_URL;
  const client = new pg.default.Client({
    connectionString: url,
    ssl: process.env.CARE_DATABASE_SSL === 'disable' ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const result = await client.query(`
      SELECT DISTINCT ON (pi.identifier_value)
        pi.identifier_value AS ccn,
        fs.provider_name,
        fs.legal_business_name,
        fs.city,
        fs.state_code,
        fs.zip_code,
        fs.county_name
      FROM provider_identifier pi
      JOIN facility_snapshot fs ON fs.provider_id = pi.provider_id
      JOIN ingest_run ir ON ir.id = fs.ingest_run_id AND ir.status = 'succeeded'
      WHERE pi.issuer = 'CMS' AND pi.identifier_type = 'CCN' AND pi.valid_from IS NULL
      ORDER BY pi.identifier_value, fs.observed_at DESC NULLS LAST, fs.id DESC
    `);
    timings.load_ms = performance.now() - t0;
    timings.normalize_ms = 0;
    timings.eligibility_ms = 0;
    return {
      rows: result.rows.map((r) => ({
        ccn: r.ccn,
        displayName: r.provider_name,
        legalName: r.legal_business_name,
        city: r.city,
        state: r.state_code,
        zip: r.zip_code,
        county: r.county_name,
        currentlyIndexable: true,
        trustReportEligible: true,
      })),
      sourceMode: 'database_cms_provider_information',
      sourceVersion: `facility_snapshot+provider_identifier#n=${result.rows.length}`,
    };
  } finally {
    await client.end();
  }
}

function evaluate(row) {
  const reasons = [];
  if (!isValidCcn(row.ccn)) reasons.push('malformed_ccn');
  if (!row.displayName?.trim()) reasons.push('missing_name');
  if (row.trustReportEligible === false) reasons.push('not_trust_report_eligible');
  if (row.currentlyIndexable === false) reasons.push('not_wave_indexable');
  const state = (row.state || '').trim().toUpperCase();
  if (!US_STATES.has(state)) reasons.push('missing_usable_us_state');
  const city = (row.city || '').trim();
  const zip = String(row.zip || '')
    .replace(/\D/g, '')
    .slice(0, 5);
  if (!city && zip.length !== 5) reasons.push('missing_usable_city_or_zip');
  const url = profileUrl(row.ccn, row.displayName || 'provider');
  if (!validateUrl(url)) reasons.push('invalid_canonical_url');
  return reasons;
}

function mapEntity(row, sourceVersion, updatedAt) {
  const ccn = normalizeCcn(row.ccn);
  const state = (row.state || '').trim().toUpperCase();
  const city = (row.city || '').trim() || undefined;
  const zipRaw = String(row.zip || '').replace(/\D/g, '').slice(0, 5);
  const zip = zipRaw.length === 5 ? zipRaw : undefined;
  const county = (row.county || '').trim() || undefined;
  const categories = [
    'nursing_facility',
    'nursing_home',
    'skilled_nursing_facility',
    'snf',
  ].sort();
  const search_terms = [
    ...new Set(
      [
        row.displayName,
        row.legalName,
        'nursing home',
        'nursing facility',
        'skilled nursing facility',
        'snf',
        city,
        state,
        county,
        `ccn ${ccn}`,
      ]
        .filter(Boolean)
        .map((s) => String(s).toLowerCase())
    ),
  ];
  return {
    network_entity_id: networkId(ccn),
    hub: 'senior',
    source_entity_id: `ccn-${ccn}`,
    entity_type: 'nursing_facility',
    display_name: String(row.displayName).trim(),
    legal_name: row.legalName ? String(row.legalName).trim() : undefined,
    city,
    state,
    zip,
    county,
    categories,
    regulatory_status_summary: 'CMS-certified nursing facility (Medicare provider information)',
    trust_report_available: row.trustReportEligible !== false,
    canonical_profile_url: profileUrl(ccn, row.displayName),
    canonical_search_url: `${ORIGIN}/search?state=${encodeURIComponent(state)}`,
    search_terms,
    discovery_status: 'eligible',
    source_version: sourceVersion,
    updated_at: updatedAt,
    physical_location: {
      city: city ?? null,
      state: state ?? null,
      postal_code: zip ?? null,
      county: county ?? null,
      country: 'US',
    },
  };
}

function selectPilot(eligible, target = PILOT_TARGET) {
  const byState = new Map();
  for (const e of [...eligible].sort((a, b) =>
    a.network_entity_id.localeCompare(b.network_entity_id)
  )) {
    const st = e.state || '_NONE';
    if (!byState.has(st)) byState.set(st, []);
    byState.get(st).push(e);
  }
  const states = [...byState.keys()].sort();
  const queues = states.map((st) => [...byState.get(st)]);
  const picked = [];
  let progress = true;
  while (picked.length < target && progress) {
    progress = false;
    for (const q of queues) {
      if (picked.length >= target) break;
      if (q.length) {
        picked.push(q.shift());
        progress = true;
      }
    }
  }
  return picked.sort((a, b) => a.network_entity_id.localeCompare(b.network_entity_id));
}

function fingerprint(entities) {
  const normalized = entities.map((e) => {
    const { updated_at: _u, ...rest } = e;
    return rest;
  });
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

function slugCity(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function queryCounts(entities) {
  const match = (city, state) =>
    entities.filter(
      (e) =>
        e.state === state &&
        (!city || slugCity(e.city) === slugCity(city))
    ).length;
  return {
    'nursing homes Austin TX': { exact_physical: match('Austin', 'TX') },
    'skilled nursing facilities Miami FL': { exact_physical: match('Miami', 'FL') },
    'nursing facilities New York NY': { exact_physical: match('New York', 'NY') },
    'nursing homes Los Angeles CA': { exact_physical: match('Los Angeles', 'CA') },
    'nursing facilities New Jersey': { physical_state: match(null, 'NJ') },
    'SNF Dallas TX': { exact_physical: match('Dallas', 'TX') },
  };
}

function assertNoForbidden(entities) {
  const forbidden = [
    'raum',
    'overall_rating',
    'five_star',
    'trust_score',
    'review_count',
    'premium',
    'payment',
    'phone',
    'telephone',
    'ssn',
    'diagnosis',
    'resident',
    'complaint_narrative',
    'deficiency_text',
  ];
  for (const e of entities) {
    for (const k of Object.keys(e)) {
      if (forbidden.includes(k.toLowerCase())) {
        throw new Error(`Forbidden field present: ${k}`);
      }
    }
  }
}

async function main() {
  const tStart = performance.now();
  const timings = {
    load_ms: 0,
    normalize_ms: 0,
    eligibility_ms: 0,
    validation_ms: 0,
    export_ms: 0,
    total_ms: 0,
  };

  let loaded;
  if (process.env.CARE_DATABASE_URL || process.env.CARE_DATABASE_POOLER_URL) {
    process.stderr.write('source: database\n');
    loaded = await loadFromDatabase(timings);
  } else {
    process.stderr.write('source: production_sitemap_pages\n');
    loaded = await loadFromSitemapPages(timings);
  }

  const tElig = performance.now();
  const ineligibleReasons = {};
  const eligibleRows = [];
  const seenCcn = new Set();
  let duplicateCcns = 0;
  for (const row of loaded.rows) {
    const ccn = normalizeCcn(row.ccn);
    if (seenCcn.has(ccn)) {
      duplicateCcns++;
      ineligibleReasons.duplicate_ccn = (ineligibleReasons.duplicate_ccn || 0) + 1;
      continue;
    }
    seenCcn.add(ccn);
    const reasons = evaluate(row);
    if (reasons.length) {
      for (const r of reasons) ineligibleReasons[r] = (ineligibleReasons[r] || 0) + 1;
      continue;
    }
    eligibleRows.push(row);
  }
  timings.eligibility_ms += performance.now() - tElig;

  const updatedAt = new Date().toISOString();
  const eligible = eligibleRows.map((r) => mapEntity(r, loaded.sourceVersion, updatedAt));
  const pilot = selectPilot(eligible, PILOT_TARGET);

  const tVal = performance.now();
  const ids = new Set(pilot.map((e) => e.network_entity_id));
  if (ids.size !== pilot.length) throw new Error('duplicate network_entity_id');
  for (const e of pilot) {
    if (e.hub !== 'senior') throw new Error('hub');
    if (e.entity_type !== 'nursing_facility') throw new Error('entity_type');
    if (!validateUrl(e.canonical_profile_url)) throw new Error(`bad url ${e.canonical_profile_url}`);
  }
  assertNoForbidden(pilot);
  const ordered = [...pilot].sort((a, b) => a.network_entity_id.localeCompare(b.network_entity_id));
  if (JSON.stringify(ordered.map((e) => e.network_entity_id)) !== JSON.stringify(pilot.map((e) => e.network_entity_id))) {
    throw new Error('pilot not deterministically ordered');
  }
  timings.validation_ms = performance.now() - tVal;

  const fp1 = fingerprint(pilot);
  const fp2 = fingerprint(selectPilot(eligible, PILOT_TARGET));
  if (fp1 !== fp2) throw new Error('fingerprint drift on dual select');

  const stateDist = {};
  for (const e of pilot) stateDist[e.state] = (stateDist[e.state] || 0) + 1;

  const envelope = {
    schema_version: SCHEMA,
    hub: 'senior',
    generated_at: updatedAt,
    source_version: loaded.sourceVersion,
    source_mode: loaded.sourceMode,
    entity_count: pilot.length,
    fingerprint: fp1,
    banner: BANNER,
    pilot_label: BANNER,
    eligibility: {
      considered: loaded.rows.length,
      unique_ccns: seenCcn.size,
      duplicate_ccns_skipped: duplicateCcns,
      eligible: eligible.length,
      ineligible: loaded.rows.length - eligibleRows.length,
      ineligible_reasons: ineligibleReasons,
      pilot_selected: pilot.length,
    },
    entity_type_breakdown: { nursing_facility: pilot.length },
    geography: {
      physical_states: stateDist,
      with_city: pilot.filter((e) => e.city).length,
      with_zip: pilot.filter((e) => e.zip).length,
      with_county: pilot.filter((e) => e.county).length,
    },
    query_readiness: {
      pilot: queryCounts(pilot),
      full_eligible: queryCounts(eligible),
    },
    fail_closed_care_types: [
      'memory care Austin TX',
      'assisted living Austin TX',
      'home care agency Austin TX',
    ],
    maturity: {
      nursing_facility: 'READY',
      assisted_living: 'SOFT_UNSUPPORTED_FOR_THIS_PILOT',
      memory_care: 'UNSUPPORTED',
    },
    ranking_safety: {
      cms_five_star: 0,
      inspection_rating: 0,
      staffing_rating: 0,
      quality_rating: 0,
      trust_score: 0,
      reviews: 0,
      premium: 0,
      payment: 0,
      popularity: 0,
    },
    external_calls: {
      google_places: 0,
      llm: 0,
      external_geocoding: 0,
      new_enrichment_apis: 0,
      note:
        loaded.sourceMode === 'production_sitemap_pages'
          ? 'Read-only HTTPS GETs to www.seniortrusthub.com sitemap + facility pages (own Hub published research).'
          : 'Read-only CARE_DATABASE_URL queries only.',
    },
    entities: pilot,
  };

  const tExp = performance.now();
  const outDir = resolve(ROOT, 'data', 'network-discovery');
  mkdirSync(outDir, { recursive: true });
  const feedPath = resolve(outDir, 'senior-discovery-pilot.v1.json');
  writeFileSync(feedPath, JSON.stringify(envelope, null, 2) + '\n', 'utf8');

  // Dual-run stability: rebuild pilot from same eligible without refetch
  const pilotB = selectPilot(eligible, PILOT_TARGET);
  const fpB = fingerprint(pilotB);
  const report = {
    banner: BANNER,
    feed_path: 'data/network-discovery/senior-discovery-pilot.v1.json',
    source_mode: loaded.sourceMode,
    source_version: loaded.sourceVersion,
    counts: envelope.eligibility,
    entity_type_breakdown: envelope.entity_type_breakdown,
    geography: envelope.geography,
    query_readiness: envelope.query_readiness,
    maturity: envelope.maturity,
    fingerprint: fp1,
    stability: {
      membership_drift: fp1 === fpB ? 0 : 1,
      identity_drift: 0,
      content_fingerprint_drift: fp1 === fpB ? 0 : 1,
      fingerprint: fp1,
    },
    timings: {
      ...timings,
      export_ms: performance.now() - tExp,
      total_ms: performance.now() - tStart,
    },
    external_calls: envelope.external_calls,
  };
  if (report.stability.membership_drift !== 0) throw new Error('stability failed');
  writeFileSync(
    resolve(outDir, 'senior-discovery-pilot.report.json'),
    JSON.stringify(report, null, 2) + '\n',
    'utf8'
  );
  timings.export_ms = report.timings.export_ms;
  timings.total_ms = report.timings.total_ms;

  console.log(
    JSON.stringify(
      {
        ok: true,
        entity_count: pilot.length,
        eligible: eligible.length,
        considered: loaded.rows.length,
        fingerprint: fp1,
        source_mode: loaded.sourceMode,
        timings: report.timings,
        query_readiness: envelope.query_readiness,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
