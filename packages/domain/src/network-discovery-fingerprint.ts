/** Node-only fingerprint (node:crypto). Do not import from client bundles. */
import { createHash } from 'node:crypto';
import { contentFingerprintPayload, type SeniorDiscoveryEntity } from './network-discovery';

export function contentFingerprint(entities: SeniorDiscoveryEntity[]): string {
  return createHash('sha256')
    .update(JSON.stringify(contentFingerprintPayload(entities)))
    .digest('hex');
}
