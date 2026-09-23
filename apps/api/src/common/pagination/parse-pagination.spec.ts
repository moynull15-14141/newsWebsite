import { parsePositiveInt, parsePage } from './parse-pagination';

describe('parsePositiveInt', () => {
  it('parses a valid value within bounds', () => {
    expect(parsePositiveInt('20', 10, 100)).toBe(20);
  });

  it('caps a value that exceeds the max, rather than passing an unbounded number through', () => {
    expect(parsePositiveInt('999999', 20, 100)).toBe(100);
  });

  it('falls back to the default for missing, non-numeric, zero, or negative input', () => {
    expect(parsePositiveInt(undefined, 20, 100)).toBe(20);
    expect(parsePositiveInt('not-a-number', 20, 100)).toBe(20);
    expect(parsePositiveInt('0', 20, 100)).toBe(20);
    expect(parsePositiveInt('-5', 20, 100)).toBe(20);
  });

  it('rejects Infinity/NaN-producing input instead of letting it through', () => {
    expect(parsePositiveInt('Infinity', 20, 100)).toBe(20);
  });
});

describe('parsePage', () => {
  it('parses a valid page number', () => {
    expect(parsePage('5')).toBe(5);
  });

  it('falls back to page 1 for missing, non-numeric, zero, or negative input', () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage('abc')).toBe(1);
    expect(parsePage('0')).toBe(1);
    expect(parsePage('-3')).toBe(1);
  });
});
