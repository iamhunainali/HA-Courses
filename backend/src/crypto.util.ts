import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

// Secrets (SMTP password, gateway keys) database mein encrypted rakhe jate hain
const key = () => createHash('sha256').update(process.env.JWT_SECRET || 'dev_secret').digest();
export const enc = (t: string) => {
  if (!t) return '';
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const e = Buffer.concat([c.update(t, 'utf8'), c.final()]);
  return 'enc:' + Buffer.concat([iv, c.getAuthTag(), e]).toString('base64');
};
export const dec = (t: string) => {
  if (!t || !t.startsWith('enc:')) return t || '';
  try {
    const b = Buffer.from(t.slice(4), 'base64');
    const d = createDecipheriv('aes-256-gcm', key(), b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
  } catch { return ''; }
};
