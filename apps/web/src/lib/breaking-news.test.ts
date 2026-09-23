import { describe, expect, it } from 'vitest';
import { resolveBackground, computeTrackDurationMs } from './breaking-news';

describe('resolveBackground', () => {
  it('returns the solid color when mode is SOLID', () => {
    expect(resolveBackground({ backgroundMode: 'SOLID', backgroundColor: '#D32F2F' })).toBe('#D32F2F');
  });

  it('builds a gradient with the requested direction', () => {
    const css = resolveBackground({ backgroundMode: 'GRADIENT', backgroundColor: '#000', gradientStart: '#111111', gradientEnd: '#222222', gradientDirection: 'RIGHT_LEFT' });
    expect(css).toBe('linear-gradient(to left, #111111, #222222)');
  });

  it('falls back to the solid color when gradient colors are missing', () => {
    expect(resolveBackground({ backgroundMode: 'GRADIENT', backgroundColor: '#D32F2F' })).toBe('#D32F2F');
  });
});

describe('computeTrackDurationMs', () => {
  it('sums each item\'s own speed, so more/slower items make one loop take longer', () => {
    expect(computeTrackDurationMs([{ animationSpeedMs: 10000 }, { animationSpeedMs: 8000 }])).toBe(18000);
  });

  it('falls back to a sane default duration for an empty list', () => {
    expect(computeTrackDurationMs([])).toBe(18000);
  });

  it('never returns an unreasonably short duration', () => {
    expect(computeTrackDurationMs([{ animationSpeedMs: 500 }])).toBeGreaterThanOrEqual(4000);
  });
});
