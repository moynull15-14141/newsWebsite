import { describe, expect, it } from 'vitest';
import { contentLanguage } from './content-language';

describe('contentLanguage', () => {
  it('identifies Bengali and mixed Bengali/Latin text', () => {
    expect(contentLanguage('প্রযুক্তি ও AI')).toBe('bn');
  });

  it('leaves Latin-only content unspecified', () => {
    expect(contentLanguage('Technology')).toBeUndefined();
  });
});
