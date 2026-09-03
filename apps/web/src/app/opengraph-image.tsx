import { renderSeniorFallbackImage } from '@/og/senior-share-card';

export const runtime = 'edge';
export const alt = 'Senior Trust Hub — Independent Senior Care Research';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() { return renderSeniorFallbackImage(); }
