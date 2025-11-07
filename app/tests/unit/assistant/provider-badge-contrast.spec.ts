import { describe, expect, it } from 'vitest';
import { PROVIDER_TOKENS } from '@/services/assistant/providerTokens';

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return [r, g, b];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };

  const [rLin, gLin, bLin] = [channel(r), channel(g), channel(b)];
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

function contrastRatio(bgHex: string, fgHex: string): number {
  const bgLum = relativeLuminance(hexToRgb(bgHex));
  const fgLum = relativeLuminance(hexToRgb(fgHex));
  const lighter = Math.max(bgLum, fgLum);
  const darker = Math.min(bgLum, fgLum);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('ProviderBadge contrast compliance (FR-034)', () => {
  it('maintains contrast ratio ≥ 4.5 for each provider token', () => {
    for (const token of Object.values(PROVIDER_TOKENS)) {
      const ratio = contrastRatio(token.bgColor, token.color);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });
});
