import { dec, enc } from './crypto.util';
import { PrismaService } from './prisma.service';

export const MASK = '••••••••';
const SECRETS: [string, string][] = [['jazzcash', 'password'], ['jazzcash', 'salt'], ['easypaisa', 'hashKey']];

export async function loadGateway(db: PrismaService, mask = false) {
  const r = await db.setting.findUnique({ where: { key: 'gatewayConfig' } });
  let c: any = {};
  try { c = r ? JSON.parse(r.value) : {}; } catch {}
  c.jazzcash = c.jazzcash || {}; c.easypaisa = c.easypaisa || {};
  for (const [g, k] of SECRETS) { const v = dec(c[g][k] || ''); c[g][k] = mask ? (v ? MASK : '') : v; }
  return c;
}

export async function saveGateway(db: PrismaService, b: any) {
  const old = await loadGateway(db);
  const c: any = { publicUrl: String(b.publicUrl || '').trim().replace(/\/+$/, ''), jazzcash: { ...(b.jazzcash || {}) }, easypaisa: { ...(b.easypaisa || {}) } };
  for (const [g, k] of SECRETS) { const v = c[g][k]; c[g][k] = enc(v === MASK || v === undefined ? old[g][k] || '' : String(v)); }
  const value = JSON.stringify(c);
  await db.setting.upsert({ where: { key: 'gatewayConfig' }, update: { value }, create: { key: 'gatewayConfig', value } });
}
