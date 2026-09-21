import { validateProductionSeedPassword, isKnownDemoPassword } from './seed-password';

const STRONG = 'Bangla-News!2026';

describe('validateProductionSeedPassword (production)', () => {
  // 1. Missing
  it('rejects a missing production password', () => {
    expect(() => validateProductionSeedPassword(undefined)).toThrow(/required in production/);
  });

  // 2. Empty
  it('rejects an empty production password', () => {
    expect(() => validateProductionSeedPassword('')).toThrow(/required in production/);
  });

  // 3. Too short
  it('rejects passwords shorter than 12 characters', () => {
    expect(() => validateProductionSeedPassword('Abc!2345')).toThrow(/security policy/);
  });

  // 4. No uppercase
  it('rejects passwords without an uppercase letter', () => {
    expect(() => validateProductionSeedPassword('bangla-news!2026')).toThrow(/security policy/);
  });

  // 5. No lowercase
  it('rejects passwords without a lowercase letter', () => {
    expect(() => validateProductionSeedPassword('BANGLA-NEWS!2026')).toThrow(/security policy/);
  });

  // 6. No number
  it('rejects passwords without a number', () => {
    expect(() => validateProductionSeedPassword('Bangla-News!!xx')).toThrow(/security policy/);
  });

  // 7. No special character
  it('rejects passwords without a special character', () => {
    expect(() => validateProductionSeedPassword('BanglaNews2026x')).toThrow(/security policy/);
  });

  // 8. Demo password (exact, case-sensitive)
  it('rejects the known demo password admin123', () => {
    expect(() => validateProductionSeedPassword('admin123')).toThrow(/demo or insecure/);
  });

  // 9. Strong password accepted
  it('accepts a strong password', () => {
    expect(() => validateProductionSeedPassword(STRONG)).not.toThrow();
  });

  // 10. No password echo in errors
  it('never includes the supplied password in the error message', () => {
    const attempts = ['admin123', 'short', 'weakpassword', 'BanglaNews2026x'];
    for (const attempt of attempts) {
      try {
        validateProductionSeedPassword(attempt);
        throw new Error(`Expected rejection for password of length ${attempt.length}`);
      } catch (e) {
        expect((e as Error).message).not.toContain(attempt);
      }
    }
  });

  // 11. No logging
  it('does not log the password via console', () => {
    const logs: string[] = [];
    const spyLog = jest.spyOn(console, 'log').mockImplementation(((...args: unknown[]) => logs.push(args.join(' '))) as never);
    const spyWarn = jest.spyOn(console, 'warn').mockImplementation(((...args: unknown[]) => logs.push(args.join(' '))) as never);
    const spyError = jest.spyOn(console, 'error').mockImplementation(((...args: unknown[]) => logs.push(args.join(' '))) as never);
    try {
      try {
        validateProductionSeedPassword('admin123');
      } catch {
        // expected
      }
      validateProductionSeedPassword(STRONG);
      const joined = logs.join('\n');
      expect(joined).not.toContain('admin123');
      expect(joined).not.toContain(STRONG);
    } finally {
      spyLog.mockRestore();
      spyWarn.mockRestore();
      spyError.mockRestore();
    }
  });
});

describe('isKnownDemoPassword', () => {
  it('rejects the exact demo password', () => {
    expect(isKnownDemoPassword('admin123')).toBe(true);
  });

  it('rejects other known demo passwords', () => {
    expect(isKnownDemoPassword('password')).toBe(true);
    expect(isKnownDemoPassword('changeme')).toBe(true);
  });

  it('does not treat strong passwords as demo passwords', () => {
    expect(isKnownDemoPassword(STRONG)).toBe(false);
  });

  // 12/13. Development behavior: demo credentials remain usable in dev only;
  // the production validator always blocks them regardless of other rules.
  it('production validation blocks demo credentials in every case', () => {
    expect(() => validateProductionSeedPassword('admin123')).toThrow(/demo or insecure/);
  });
});
