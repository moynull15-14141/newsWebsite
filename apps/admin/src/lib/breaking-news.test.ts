import { describe, expect, it } from 'vitest';
import { isValidHexColor, resolveBackground, reorderByStep } from './breaking-news';

describe('isValidHexColor', () => {
  it('accepts 3- and 6-digit hex colors', () => {
    expect(isValidHexColor('#FFF')).toBe(true);
    expect(isValidHexColor('#D32F2F')).toBe(true);
  });

  it('rejects named colors and unsafe values', () => {
    expect(isValidHexColor('red')).toBe(false);
    expect(isValidHexColor('rgb(255,0,0)')).toBe(false);
    expect(isValidHexColor('url(javascript:alert(1))')).toBe(false);
    expect(isValidHexColor('#12345')).toBe(false);
  });
});

describe('resolveBackground', () => {
  it('returns the solid color when mode is SOLID', () => {
    expect(resolveBackground({ backgroundMode: 'SOLID', backgroundColor: '#D32F2F', textColor: '#FFF' })).toBe('#D32F2F');
  });

  it('builds a left-to-right gradient by default direction', () => {
    const css = resolveBackground({ backgroundMode: 'GRADIENT', backgroundColor: '#000', gradientStart: '#111111', gradientEnd: '#222222', textColor: '#FFF' });
    expect(css).toBe('linear-gradient(to right, #111111, #222222)');
  });

  it('respects an explicit gradient direction', () => {
    const css = resolveBackground({ backgroundMode: 'GRADIENT', backgroundColor: '#000', gradientStart: '#111111', gradientEnd: '#222222', gradientDirection: 'TOP_BOTTOM', textColor: '#FFF' });
    expect(css).toBe('linear-gradient(to bottom, #111111, #222222)');
  });

  it('falls back to the solid color if GRADIENT mode is set but colors are missing', () => {
    expect(resolveBackground({ backgroundMode: 'GRADIENT', backgroundColor: '#D32F2F', textColor: '#FFF' })).toBe('#D32F2F');
  });
});

describe('reorderByStep', () => {
  const items = [{ id: 'a', priority: 1 }, { id: 'b', priority: 2 }, { id: 'c', priority: 3 }];

  it('swaps with the previous item when moving up', () => {
    expect(reorderByStep(items, 1, 'up')).toEqual(['b', 'a', 'c']);
  });

  it('swaps with the next item when moving down', () => {
    expect(reorderByStep(items, 1, 'down')).toEqual(['a', 'c', 'b']);
  });

  it('does nothing when moving the first item up', () => {
    expect(reorderByStep(items, 0, 'up')).toEqual(['a', 'b', 'c']);
  });

  it('does nothing when moving the last item down', () => {
    expect(reorderByStep(items, 2, 'down')).toEqual(['a', 'b', 'c']);
  });
});
