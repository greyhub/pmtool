import { randomBytes, createHash } from 'node:crypto';

export function generateLinkCodeRaw(): string {
  return randomBytes(16).toString('hex');
}

export function hashLinkCode(rawCode: string): string {
  return createHash('sha256').update(rawCode).digest('hex');
}
