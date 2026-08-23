import { describe, expect, it } from 'vitest';
import {
  ASK_HANDOFF_FORBIDDEN_KEYS,
  ASK_HANDOFF_SORT,
  askHandoffUsesCommercialRanking,
  buildAskBackLabel,
  buildAskSearchHref,
  facilityHrefWithAskContext,
  isForbiddenAskHandoffKey,
  parseSeniorAskSearchContext,
  physicalPlaceMatches,
  resolveAskHandoffDestination,
  serializeAskSearchContext,
} from './ask-handoff';

describe('ASK-SEARCH-SENIOR-002 handoff', () => {
  it('requires src=ask', () => {
    expect(parseSeniorAskSearchContext({ entity: 'nursing_facility', state: 'TX' })).toBeNull();
    expect(parseSeniorAskSearchContext({ src: 'senior', entity: 'nursing_facility' })).toBeNull();
  });

  it('maps nursing / SNF aliases to nursing_facility', () => {
    for (const entity of ['nursing_facility', 'nursing_home', 'skilled_nursing_facility', 'snf']) {
      const ctx = parseSeniorAskSearchContext({ src: 'ask', entity, state: 'FL', city: 'miami' });
      expect(ctx?.entityType).toBe('nursing_facility');
      expect(ctx?.unsupported).toBeUndefined();
    }
  });

  it('fails closed for assisted living, memory care, and home care', () => {
    expect(
      parseSeniorAskSearchContext({ src: 'ask', entity: 'assisted_living', state: 'TX', city: 'austin' })
        ?.unsupported,
    ).toBe('assisted_living');
    expect(
      parseSeniorAskSearchContext({ src: 'ask', entity: 'memory_care', state: 'TX', city: 'austin' })
        ?.unsupported,
    ).toBe('memory_care');
    expect(
      parseSeniorAskSearchContext({
        src: 'ask',
        entity: 'home_care_agency',
        state: 'TX',
        city: 'austin',
      })?.unsupported,
    ).toBe('home_care');
  });

  it('ignores raw query, PII, PHI, and redirect keys', () => {
    const ctx = parseSeniorAskSearchContext({
      src: 'ask',
      entity: 'nursing_facility',
      state: 'TX',
      city: 'austin',
      q: 'nursing homes Austin TX',
      query: 'secret',
      patient_name: 'John',
      resident_name: 'Jane',
      diagnosis: 'dementia',
      medication: 'x',
      medical_record: 'mrn',
      health_data: 'phi',
      next: 'https://evil.example',
      redirect: '//evil.example',
      returnUrl: 'https://evil.example',
    });
    expect(ctx?.unsupported).toBeUndefined();
    const qs = serializeAskSearchContext(ctx!);
    expect(qs).not.toMatch(/q=|query=|patient|resident|diagnosis|medication|health_data|evil/i);
    const href = buildAskSearchHref(ctx!);
    expect(href).not.toMatch(/q=|query=|evil|diagnosis|patient/i);
    expect(href.startsWith('/search?')).toBe(true);
    expect(href).toContain('sort=name');
    expect(href).not.toContain('cms-overall');
  });

  it('rejects XSS / traversal tokens in city, zip, county, entity, sid', () => {
    const ctx = parseSeniorAskSearchContext({
      src: 'ask',
      entity: 'javascript:alert(1)',
      city: '<script>',
      zip: 'abc',
      county: '../../',
      sid: '<script>',
      category: '<img>',
      state: 'XX',
    });
    expect(ctx?.city).toBeUndefined();
    expect(ctx?.zip).toBeUndefined();
    expect(ctx?.county).toBeUndefined();
    expect(ctx?.sid).toBeUndefined();
    expect(ctx?.state).toBeUndefined();
    expect(ctx?.unsupported).toBeTruthy();
    const dest = resolveAskHandoffDestination(ctx!);
    expect(dest.href.startsWith('/from-ask/unsupported')).toBe(true);
    expect(dest.href).not.toContain('evil');
    expect(dest.href).not.toContain('script');
  });

  it('uses physical city equality — county does not become city', () => {
    expect(physicalPlaceMatches('Austin', 'austin')).toBe(true);
    expect(physicalPlaceMatches('South Austin', 'austin')).toBe(false);
    expect(physicalPlaceMatches('Miami', 'miami')).toBe(true);
    expect(physicalPlaceMatches('Miami Beach', 'miami')).toBe(false);
    expect(physicalPlaceMatches('Los Angeles', 'los-angeles')).toBe(true);
    expect(physicalPlaceMatches('New York', 'new-york')).toBe(true);
  });

  it('builds Back to Results labels from structured place only', () => {
    const austin = parseSeniorAskSearchContext({
      src: 'ask',
      entity: 'nursing_home',
      state: 'TX',
      city: 'austin',
    })!;
    expect(buildAskBackLabel(austin)).toBe('← Back to nursing facilities in Austin, Texas');
    const miami = parseSeniorAskSearchContext({
      src: 'ask',
      entity: 'snf',
      state: 'FL',
      city: 'miami',
    })!;
    expect(buildAskBackLabel(miami)).toBe('← Back to skilled nursing facilities in Miami, Florida');
    const nj = parseSeniorAskSearchContext({ src: 'ask', entity: 'nursing_facility', state: 'NJ' })!;
    expect(buildAskBackLabel(nj)).toBe('← Back to nursing facilities in New Jersey');
    expect(buildAskBackLabel(austin)).not.toMatch(/John|dementia|best|top rated/i);
  });

  it('keeps facility profile path clean of query in the canonical path', () => {
    const ctx = parseSeniorAskSearchContext({
      src: 'ask',
      entity: 'nursing_facility',
      state: 'FL',
      city: 'miami',
    })!;
    const href = facilityHrefWithAskContext('105502', 'example-snf', ctx);
    expect(href.startsWith('/facility/cms/105502/example-snf?')).toBe(true);
    expect(href).toContain('src=ask');
    expect(href).not.toMatch(/q=|query=|diagnosis|patient/i);
  });

  it('never ranks Ask results by ratings, payment, or popularity', () => {
    expect(ASK_HANDOFF_SORT).toBe('name');
    expect(askHandoffUsesCommercialRanking()).toBe(false);
    const href = buildAskSearchHref(
      parseSeniorAskSearchContext({ src: 'ask', entity: 'nursing_facility', state: 'NJ' })!,
    );
    expect(href).toContain('sort=name');
    expect(href).not.toMatch(/overall|staffing|inspection|premium|payment|popularity/i);
  });

  it('treats forbidden keys as ignored, not accepted', () => {
    for (const key of ASK_HANDOFF_FORBIDDEN_KEYS) {
      expect(isForbiddenAskHandoffKey(key)).toBe(true);
    }
  });
});
