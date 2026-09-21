const DEMO_PASSWORDS = new Set(['admin123', 'password', 'password123', 'changeme', 'change-me']);

// Case-sensitive exact rejection is guaranteed here: the known demo password is
// always blocked before any policy check, and error messages never echo the
// supplied password.
export function isKnownDemoPassword(password: string): boolean {
  return password === 'admin123' || DEMO_PASSWORDS.has(password.toLowerCase());
}

export function validateProductionSeedPassword(password: string | undefined): asserts password is string {
  if (!password) throw new Error('SEED_ADMIN_PASSWORD is required in production.');
  if (isKnownDemoPassword(password)) throw new Error('SEED_ADMIN_PASSWORD is a known demo or insecure password.');
  if (password.length < 12 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    throw new Error('Production admin password does not meet the required security policy (at least 12 characters with uppercase, lowercase, number, and special character).');
  }
}
