import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { dec, enc } from './crypto.util';
import { PrismaService } from './prisma.service';

export const EMAIL_EVENTS: Record<string, { label: string; subject: string; body: string }> = {
  welcome: { label: 'Welcome email (after sign up)', subject: 'Welcome to {{siteName}}, {{name}}!', body: '<p>Hi {{name}},</p><p>Welcome to <b>{{siteName}}</b>! Your account is ready. Browse our courses and start learning today.</p>' },
  payment_received: { label: 'Payment request received', subject: 'We received your payment request', body: '<p>Hi {{name}},</p><p>We received your payment request for <b>{{course}}</b>. Our team will verify it within {{hours}} hours and you will be notified.</p>' },
  payment_approved: { label: 'Payment approved / access granted', subject: 'Access granted: {{course}}', body: '<p>Hi {{name}},</p><p>Your payment was approved. You now have access to <b>{{course}}</b>. Log in and open your dashboard to start learning.</p>' },
  payment_rejected: { label: 'Payment rejected', subject: 'Payment could not be verified', body: '<p>Hi {{name}},</p><p>Your payment for <b>{{course}}</b> could not be verified. {{reason}}</p><p>Please submit the form again.</p>' },
  access_ended: { label: 'Course access ended by admin', subject: 'Your course access has ended', body: '<p>Hi {{name}},</p><p>Your access to <b>{{course}}</b> was ended. {{reason}} To enroll again, please complete the payment again.</p>' },
  suspended: { label: 'Account suspended', subject: 'Your account has been suspended', body: '<p>Hi {{name}},</p><p>Your account was suspended. {{reason}}</p><p>You can log in again: {{until}}.</p>' },
  teacher_approved: { label: 'Teacher application approved', subject: 'Your teaching application was approved', body: '<p>Hi {{name}},</p><p>Congratulations! Your application was approved. Log in to open your Teacher portal.</p>' },
  teacher_rejected: { label: 'Teacher application rejected', subject: 'About your teaching application', body: '<p>Hi {{name}},</p><p>Thank you for applying. Unfortunately we cannot approve your application right now. {{reason}}</p>' },
};

const wrap = (site: string, inner: string) =>
  `<div style="background:#faf7f1;padding:24px;font-family:Georgia,serif"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #e8dfcf;border-top:4px solid #c8a24a;border-radius:8px;padding:28px"><h2 style="margin:0 0 14px;color:#1f3a5f">${site}</h2><div style="font-family:Arial,sans-serif;color:#1d2433;line-height:1.6">${inner}</div></div></div>`;
const render = (t: string, vars: Record<string, string>) => t.replace(/\{\{(\w+)\}\}/g, (_m, k) => vars[k] ?? '');

@Injectable()
export class MailService {
  constructor(private db: PrismaService) {}

  private async raw(key: string) {
    const r = await this.db.setting.findUnique({ where: { key } });
    try { return r ? JSON.parse(r.value) : {}; } catch { return {}; }
  }
  async config() {
    const c = await this.raw('smtpConfig');
    return { host: c.host || 'smtp.gmail.com', port: Number(c.port) || 465, secure: c.secure !== false, user: c.user || '', pass: dec(c.pass || ''), fromName: c.fromName || '', fromEmail: c.fromEmail || '' };
  }
  async saveConfig(b: any) {
    const old = await this.raw('smtpConfig');
    const c = { host: String(b.host || 'smtp.gmail.com').trim(), port: Number(b.port) || 465, secure: b.secure !== false, user: String(b.user || '').trim(), fromName: b.fromName || '', fromEmail: b.fromEmail || '',
      pass: b.pass && b.pass !== '••••••••' ? enc(String(b.pass).replace(/\s+/g, '')) : old.pass || '' };
    const value = JSON.stringify(c);
    await this.db.setting.upsert({ where: { key: 'smtpConfig' }, update: { value }, create: { key: 'smtpConfig', value } });
  }
  async siteName() { const r = await this.db.setting.findUnique({ where: { key: 'siteName' } }); return r?.value || 'Learning Portal'; }

  async send(to: string, subject: string, html: string, kind = 'manual') {
    const log = (status: string, error?: string) => this.db.emailLog.create({ data: { to, subject, kind, status, error: error || null } }).catch(() => {});
    const c = await this.config();
    if (!c.user || !c.pass) { await log('SKIPPED', 'SMTP not configured'); return { ok: false, error: 'SMTP is not configured' }; }
    const site = await this.siteName();
    try {
      const t = nodemailer.createTransport({ host: c.host, port: c.port, secure: c.secure, auth: { user: c.user, pass: c.pass } });
      await t.sendMail({ from: `"${c.fromName || site}" <${c.fromEmail || c.user}>`, to, subject, html: wrap(site, html) });
      await log('SENT');
      return { ok: true };
    } catch (e: any) { await log('FAILED', String(e.message || e).slice(0, 300)); return { ok: false, error: String(e.message || e) }; }
  }

  async automations() {
    const saved = await this.raw('emailAutomations');
    return Object.fromEntries(Object.entries(EMAIL_EVENTS).map(([k, v]) => [k, { label: v.label, enabled: saved[k]?.enabled ?? true, subject: saved[k]?.subject || v.subject, body: saved[k]?.body || v.body }]));
  }
  async saveAutomations(a: any) {
    const value = JSON.stringify(a);
    await this.db.setting.upsert({ where: { key: 'emailAutomations' }, update: { value }, create: { key: 'emailAutomations', value } });
  }

  // Fire-and-forget: error aaye to bhi request fail nahi hoti
  trigger(event: string, to: string, vars: Record<string, string> = {}) {
    (async () => {
      const a: any = (await this.automations())[event];
      if (!a || !a.enabled || !to) return;
      const v = { siteName: await this.siteName(), ...vars };
      await this.send(to, render(a.subject, v), render(a.body, v), event);
    })().catch(() => {});
  }
}
