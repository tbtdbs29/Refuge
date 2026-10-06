import crypto from 'node:crypto';

const KEY_LENGTH = 64;
const COST = 16384;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH, { N: COST });
  return `scrypt$${COST}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password, stored) {
  const [scheme, cost, saltB64, hashB64] = String(stored).split('$');
  const N = Number(cost);
  if (scheme !== 'scrypt' || !saltB64 || !hashB64 || !Number.isInteger(N) || N < 2) return false;
  const expected = Buffer.from(hashB64, 'base64');
  if (!expected.length) return false;
  try {
    const actual = crypto.scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length, { N });
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    // A corrupted stored hash must fail the login, not crash it.
    return false;
  }
}
