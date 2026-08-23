import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  NURSING_SNF_QUERY_SYNONYMS,
  UNSUPPORTED_CARE_TYPE_QUERIES,
  buildCanonicalFacilityProfileUrl,
  buildSeniorNetworkId,
  evaluateDiscoveryEligibility,
  isValidCcn,
  mapFacilityToDiscovery,
  matchesPhysicalCity,
  matchesPhysicalState,
  normalizeCcn,
  nursingSynonymMatchesFacility,
  rejectDuplicateCcns,
  selectPilotCohort,
  unsupportedCareTypeMatchesNursingFacility,
  validateCanonicalFacilityUrl,
  contentFingerprintPayload,
} from './network-discovery';

function fp(entities: ReturnType<typeof mapFacilityToDiscovery>[]) {
  return createHash('sha256')
    .update(JSON.stringify(contentFingerprintPayload(entities)))
    .digest('hex');
}

describe('ASK-SEARCH-SENIOR-001 network discovery', () => {
  it('builds CCN network ids and rejects malformed CCNs', () => {
    expect(buildSeniorNetworkId('015009')).toBe('senior:ccn-015009');
    expect(normalizeCcn(' 05a189 ')).toBe('05A189');
    expect(isValidCcn('015009')).toBe(true);
    expect(isValidCcn('15009')).toBe(false);
    expect(isValidCcn('name-only')).toBe(false);
  });

  it('rejects duplicate CCNs', () => {
    const a = mapFacilityToDiscovery({
      ccn: '015009',
      displayName: 'A',
      state: 'AL',
      city: 'Russellville',
    });
    const b = mapFacilityToDiscovery({
      ccn: '015009',
      displayName: 'B',
      state: 'TX',
      city: 'Austin',
    });
    expect(rejectDuplicateCcns([a, b]).ok).toBe(false);
  });

  it('does not use facility name as network identity', () => {
    const a = mapFacilityToDiscovery({
      ccn: '100001',
      displayName: 'Same Name LLC',
      state: 'FL',
      city: 'Miami',
    });
    const b = mapFacilityToDiscovery({
      ccn: '100002',
      displayName: 'Same Name LLC',
      state: 'FL',
      city: 'Miami',
    });
    expect(a.network_entity_id).not.toBe(b.network_entity_id);
  });

  it('maps nursing/SNF synonyms to nursing_facility only', () => {
    const e = mapFacilityToDiscovery({
      ccn: '555120',
      displayName: 'Example SNF',
      state: 'CA',
      city: 'Los Angeles',
    });
    expect(e.entity_type).toBe('nursing_facility');
    expect(e.categories).toContain('snf');
    expect(e.categories).toContain('nursing_home');
    for (const syn of NURSING_SNF_QUERY_SYNONYMS) {
      expect(nursingSynonymMatchesFacility(syn)).toBe(true);
    }
  });

  it('fail-closes assisted living / memory care / home care substitution', () => {
    for (const q of UNSUPPORTED_CARE_TYPE_QUERIES) {
      expect(unsupportedCareTypeMatchesNursingFacility(q)).toEqual([]);
    }
  });

  it('requires physical city/ZIP evidence and exact city match', () => {
    const missing = evaluateDiscoveryEligibility({
      ccn: '015009',
      displayName: 'X',
      state: 'TX',
      city: null,
      zip: null,
      currentlyIndexable: true,
      trustReportEligible: true,
    });
    expect(missing.ok).toBe(false);

    const austin = mapFacilityToDiscovery({
      ccn: '675001',
      displayName: 'Austin SNF',
      state: 'TX',
      city: 'Austin',
      zip: '78701',
    });
    const dallas = mapFacilityToDiscovery({
      ccn: '675002',
      displayName: 'Dallas SNF',
      state: 'TX',
      city: 'Dallas',
    });
    expect(matchesPhysicalCity(austin, 'austin', 'TX')).toBe(true);
    expect(matchesPhysicalCity(dallas, 'austin', 'TX')).toBe(false);
    expect(matchesPhysicalState(dallas, 'TX')).toBe(true);
  });

  it('validates canonical Senior HTTPS profile URLs', () => {
    const url = buildCanonicalFacilityProfileUrl('015009', 'Burns Nursing Home Inc');
    expect(validateCanonicalFacilityUrl(url).ok).toBe(true);
    expect(url.startsWith('https://www.seniortrusthub.com/facility/cms/015009/')).toBe(true);
    expect(validateCanonicalFacilityUrl('http://www.seniortrusthub.com/facility/cms/015009/x').ok).toBe(
      false
    );
    expect(validateCanonicalFacilityUrl('https://www.movetrusthub.com/facility/cms/015009/x').ok).toBe(
      false
    );
    expect(
      validateCanonicalFacilityUrl('https://www.seniortrusthub.com/facility/cms/015009/x?q=1').ok
    ).toBe(false);
    expect(validateCanonicalFacilityUrl('https://foo.vercel.app/facility/cms/015009/x').ok).toBe(
      false
    );
  });

  it('selects deterministic query-independent cohort (no rating fields)', () => {
    const rows = ['30', '10', '20', '40'].map((n, i) =>
      mapFacilityToDiscovery({
        ccn: `10000${n}`,
        displayName: `Firm ${n}`,
        state: i % 2 === 0 ? 'TX' : 'FL',
        city: i % 2 === 0 ? 'Austin' : 'Miami',
      })
    );
    // Inject fake rating-like props on source objects — must not affect selection
    const withNoise = rows.map((e) => ({ ...e, overall_rating: 5 }) as typeof rows[0] & {
      overall_rating: number;
    });
    const pilot = selectPilotCohort(withNoise as typeof rows, 2);
    const clean = selectPilotCohort(rows, 2);
    // State round-robin (FL then TX), then final sort by network_entity_id
    expect(pilot.map((e) => e.network_entity_id)).toEqual([
      'senior:ccn-1000010',
      'senior:ccn-1000020',
    ]);
    // Rating-like noise must not change membership/order
    expect(pilot.map((e) => e.network_entity_id)).toEqual(clean.map((e) => e.network_entity_id));
  });

  it('fingerprints stably excluding updated_at', () => {
    const e = mapFacilityToDiscovery(
      {
        ccn: '045001',
        displayName: 'X',
        state: 'NJ',
        city: 'Newark',
      },
      { updatedAt: '2026-01-01T00:00:00.000Z' }
    );
    const e2 = { ...e, updated_at: '2026-08-01T00:00:00.000Z' };
    expect(fp([e])).toBe(fp([e2]));
  });

  it('omits forbidden ranking/health fields from mapped entities', () => {
    const e = mapFacilityToDiscovery({
      ccn: '225001',
      displayName: 'Safe Fields',
      state: 'NY',
      city: 'New York',
    });
    expect(e).not.toHaveProperty('overall_rating');
    expect(e).not.toHaveProperty('phone');
    expect(e).not.toHaveProperty('trust_score');
    expect(e).not.toHaveProperty('premium');
    expect(e).not.toHaveProperty('complaint_narrative');
  });
});
