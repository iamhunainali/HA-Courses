import {
  BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Patch, Post,
  Req, Res, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { diskStorage } from 'multer';
import { basename, extname, join } from 'path';
import { AdminGuard, AuthGuard } from './guards';
import { loadGateway, saveGateway } from './gateway.util';
import { MailService } from './mail.service';
import { PrismaService } from './prisma.service';

const UP = process.env.UPLOAD_DIR || '/data/uploads';
const priv = (kind: 'image' | 'pdf', mb: number) => ({
  storage: diskStorage({ destination: (_r, _f, cb) => cb(null, join(UP, 'private')), filename: (_r, f, cb) => cb(null, randomUUID() + extname(f.originalname)) }),
  limits: { fileSize: mb * 1024 * 1024 },
  fileFilter: (_r: any, f: any, cb: any) => cb(null, kind === 'image' ? /^image\//.test(f.mimetype) : f.mimetype === 'application/pdf'),
});
const popupData = (b: any) => ({
  name: String(b.name || 'Popup').trim() || 'Popup', active: b.active !== false, title: b.title || '', body: b.body || '', image: b.image || null,
  buttonText: b.buttonText || null, buttonLink: b.buttonLink || null,
  style: b.style || {}, audience: b.audience || { type: 'ALL' }, frequency: b.frequency || { mode: 'once_per_login' },
  pages: b.pages || 'all', delaySec: Math.max(0, parseInt(b.delaySec) || 0), priority: parseInt(b.priority) || 0,
  startAt: b.startAt ? new Date(b.startAt) : null, endAt: b.endAt ? new Date(b.endAt) : null,
});

/* ================= user side ================= */
@Controller()
export class ExtraController {
  constructor(private db: PrismaService) {}

  // ---- Popups: audience + frequency server par check hoti hai ----
  @UseGuards(AuthGuard) @Get('popups/active')
  async popups(@Req() req: any) {
    const u = req.user, now = new Date();
    if (u.role === 'SUPER_ADMIN') return [];
    const [list, enr, views] = await Promise.all([
      this.db.popup.findMany({ where: { active: true, AND: [{ OR: [{ startAt: null }, { startAt: { lte: now } }] }, { OR: [{ endAt: null }, { endAt: { gte: now } }] }] }, orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }] }),
      this.db.enrollment.findMany({ where: { userId: u.id, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, select: { courseId: true } }),
      this.db.popupView.findMany({ where: { userId: u.id } }),
    ]);
    const mine = new Set(enr.map((e) => e.courseId));
    const vmap = new Map(views.map((v) => [v.popupId, v]));
    const loginKey = u.lastLogin ? u.lastLogin.toISOString() : '';
    return list.filter((p) => {
      const a: any = p.audience || {}, f: any = p.frequency || {}, v = vmap.get(p.id);
      if (a.type === 'COURSE' && !(a.courseIds || []).some((c: string) => mine.has(c))) return false;
      if (a.type === 'NO_COURSE' && mine.size > 0) return false;
      if (a.type === 'NEW' && Date.now() - new Date(u.createdAt).getTime() > 7 * 86400000) return false;
      const n = v?.count || 0, sameLogin = v?.lastKey === loginKey, mode = f.mode || 'once_per_login';
      if (mode === 'once_ever') return n === 0;
      if (mode === 'once_per_login') return !sameLogin;
      if (mode === 'max_total') return n < (Number(f.maxTimes) || 1) && !sameLogin;
      return true; // every_load
    });
  }

  @UseGuards(AuthGuard) @Post('popups/:id/seen')
  async seen(@Param('id') id: string, @Req() req: any) {
    const key = req.user.lastLogin ? req.user.lastLogin.toISOString() : '';
    await this.db.popupView.upsert({ where: { popupId_userId: { popupId: id, userId: req.user.id } }, update: { count: { increment: 1 }, lastKey: key }, create: { popupId: id, userId: req.user.id, count: 1, lastKey: key } });
    return { ok: true };
  }

  // ---- Support chat (user) ----
  @UseGuards(AuthGuard) @Get('support/messages')
  async myMsgs(@Req() req: any) {
    await this.db.supportMessage.updateMany({ where: { userId: req.user.id, from: 'ADMIN', readByUser: false }, data: { readByUser: true } });
    return this.db.supportMessage.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'asc' }, take: 300 });
  }

  @UseGuards(AuthGuard) @Get('support/unread')
  async unread(@Req() req: any) { return { count: await this.db.supportMessage.count({ where: { userId: req.user.id, from: 'ADMIN', readByUser: false } }) }; }

  @UseGuards(AuthGuard) @Post('support/messages') @UseInterceptors(FileInterceptor('image', priv('image', 8)))
  async send(@Body() b: any, @UploadedFile() f: any, @Req() req: any) {
    const text = String(b.text || '').trim().slice(0, 2000);
    if (!text && !f) throw new BadRequestException('Write a message or attach a photo');
    return this.db.supportMessage.create({ data: { userId: req.user.id, from: 'USER', text, image: f?.filename || null, readByUser: true } });
  }

  @UseGuards(AuthGuard) @Get('support/image/:name')
  async img(@Param('name') name: string, @Req() req: any, @Res() res: any) {
    const m = await this.db.supportMessage.findFirst({ where: { image: basename(name) } });
    if (!m || (m.userId !== req.user.id && req.user.role !== 'SUPER_ADMIN')) throw new ForbiddenException();
    res.sendFile(join(UP, 'private', basename(name)));
  }

  // ---- Apply for teaching ----
  @UseGuards(AuthGuard) @Get('teaching/application')
  myApplication(@Req() req: any) { return this.db.teacherApplication.findFirst({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' } }); }

  @UseGuards(AuthGuard) @Post('teaching/apply') @UseInterceptors(FileInterceptor('cv', priv('pdf', 10)))
  async apply(@Body() b: any, @UploadedFile() f: any, @Req() req: any) {
    if (req.user.role !== 'USER') throw new BadRequestException('You already have teacher or admin access');
    if (await this.db.teacherApplication.findFirst({ where: { userId: req.user.id, status: 'PENDING' } })) throw new ConflictException('Your application is already under review');
    const t = (k: string) => String(b[k] || '').trim();
    if (t('name').length < 3 || t('qualification').length < 2 || t('subjects').length < 2) throw new BadRequestException('Please fill name, qualification and subjects');
    if (!/^\+?[0-9][0-9\s-]{8,18}$/.test(t('phone'))) throw new BadRequestException('Enter a valid phone number');
    if (t('bio').length < 30) throw new BadRequestException('Please write at least 30 characters about yourself');
    return this.db.teacherApplication.create({ data: {
      userId: req.user.id, name: t('name'), email: req.user.email, phone: t('phone'), city: t('city'), qualification: t('qualification'),
      experienceYears: parseInt(b.experienceYears) || 0, subjects: t('subjects'), bio: t('bio'), sampleLink: t('sampleLink') || null, cv: f?.filename || null,
    } });
  }
}

/* ================= admin side ================= */
@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class ExtraAdminController {
  constructor(private db: PrismaService, private mail: MailService) {}

  // ---- Popups ----
  @Get('popups')
  async popups() {
    const [list, sums] = await Promise.all([this.db.popup.findMany({ orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }] }), this.db.popupView.groupBy({ by: ['popupId'], _sum: { count: true }, _count: { _all: true } })]);
    return list.map((p) => { const s = sums.find((x) => x.popupId === p.id); return { ...p, shown: s?._sum.count || 0, users: s?._count._all || 0 }; });
  }
  @Post('popups') addPopup(@Body() b: any) { return this.db.popup.create({ data: popupData(b) }); }
  @Patch('popups/:id') editPopup(@Param('id') id: string, @Body() b: any) { return this.db.popup.update({ where: { id }, data: popupData(b) }); }
  @Post('popups/:id/reset') async resetPopup(@Param('id') id: string) { await this.db.popupView.deleteMany({ where: { popupId: id } }); return { ok: true }; }
  @Delete('popups/:id') async delPopup(@Param('id') id: string) { await this.db.popupView.deleteMany({ where: { popupId: id } }); await this.db.popup.delete({ where: { id } }).catch(() => {}); return { ok: true }; }

  // ---- Email / SMTP / automation ----
  @Get('email/config') async emailConfig() { const c = await this.mail.config(); return { ...c, pass: c.pass ? '••••••••' : '' }; }
  @Patch('email/config') async saveEmail(@Body() b: any) { await this.mail.saveConfig(b); return { ok: true }; }
  @Post('email/test')
  async emailTest(@Body() b: any) {
    const r = await this.mail.send(String(b.to || '').trim(), 'SMTP test email', '<p>Your SMTP settings are working ✅</p>', 'test');
    if (!r.ok) throw new BadRequestException(r.error);
    return r;
  }
  @Get('email/automations') automations() { return this.mail.automations(); }
  @Patch('email/automations') async saveAuto(@Body() b: any) { await this.mail.saveAutomations(b.automations || {}); return { ok: true }; }
  @Get('email/logs') emailLogs() { return this.db.emailLog.findMany({ orderBy: { createdAt: 'desc' }, take: 80 }); }
  @Post('email/send')
  async emailSend(@Body() b: any) {
    if (!b.subject || !b.body) throw new BadRequestException('Subject and message required');
    const html = String(b.body).replace(/\n/g, '<br>');
    if (b.to && String(b.to).toUpperCase() !== 'ALL') { const r = await this.mail.send(String(b.to).trim(), b.subject, html); if (!r.ok) throw new BadRequestException(r.error); return { sent: 1 }; }
    const users = await this.db.user.findMany({ where: { role: { not: 'SUPER_ADMIN' } }, select: { email: true }, take: 400 });
    (async () => { for (const u of users) { await this.mail.send(u.email, b.subject, html, 'bulk'); } })().catch(() => {});
    return { sent: users.length, note: 'Sending in the background. Check the email log.' };
  }

  // ---- Payment gateways ----
  @Get('gateways') gateways() { return loadGateway(this.db, true); }
  @Patch('gateways') async saveGateways(@Body() b: any) { await saveGateway(this.db, b); return { ok: true }; }

  // ---- Support inbox ----
  @Get('support/threads')
  async threads() {
    const msgs = await this.db.supportMessage.findMany({ orderBy: { createdAt: 'desc' }, take: 1000 });
    const map = new Map<string, any>();
    for (const m of msgs) {
      let t = map.get(m.userId);
      if (!t) { t = { userId: m.userId, last: m, unread: 0 }; map.set(m.userId, t); }
      if (m.from === 'USER' && !m.readByAdmin) t.unread++;
    }
    const users = await this.db.user.findMany({ where: { id: { in: [...map.keys()] } }, select: { id: true, name: true, email: true, lastSeen: true } });
    return [...map.values()].map((t) => ({ ...t, user: users.find((u) => u.id === t.userId) || null }));
  }
  @Get('support/:userId')
  async thread(@Param('userId') userId: string) {
    await this.db.supportMessage.updateMany({ where: { userId, from: 'USER', readByAdmin: false }, data: { readByAdmin: true } });
    return this.db.supportMessage.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, take: 300 });
  }
  @Post('support/:userId') @UseInterceptors(FileInterceptor('image', priv('image', 8)))
  async reply(@Param('userId') userId: string, @Body() b: any, @UploadedFile() f: any) {
    const text = String(b.text || '').trim().slice(0, 2000);
    if (!text && !f) throw new BadRequestException('Write a message or attach a photo');
    await this.db.notification.create({ data: { userId, sender: 'Support', title: 'New reply from support', message: text ? text.slice(0, 120) : 'Photo received' } });
    return this.db.supportMessage.create({ data: { userId, from: 'ADMIN', text, image: f?.filename || null, readByAdmin: true } });
  }

  // ---- Teachers ----
  @Get('teachers') teachers() { return this.db.user.findMany({ where: { role: 'TEACHER' }, select: { id: true, name: true, email: true, phone: true } }); }
  @Get('teacher-applications') applications() { return this.db.teacherApplication.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }); }

  @Post('teacher-applications/:id/approve')
  async approveApp(@Param('id') id: string, @Body() b: any) {
    const a = await this.db.teacherApplication.findUnique({ where: { id } });
    if (!a || a.status !== 'PENDING') throw new BadRequestException('Already reviewed');
    const u = await this.db.user.findUnique({ where: { id: a.userId } });
    if (u && u.role === 'USER') await this.db.user.update({ where: { id: u.id }, data: { role: 'TEACHER' } });
    await this.db.teacherApplication.update({ where: { id }, data: { status: 'APPROVED', reviewedAt: new Date(), note: b.note || null } });
    if (u) await this.db.notification.create({ data: { userId: u.id, sender: 'Admin', title: 'Teacher application approved', message: 'You now have access to the Teacher portal.' } });
    this.mail.trigger('teacher_approved', a.email, { name: a.name });
    return { ok: true };
  }
  @Post('teacher-applications/:id/reject')
  async rejectApp(@Param('id') id: string, @Body() b: any) {
    const a = await this.db.teacherApplication.findUnique({ where: { id } });
    if (!a || a.status !== 'PENDING') throw new BadRequestException('Already reviewed');
    await this.db.teacherApplication.update({ where: { id }, data: { status: 'REJECTED', reviewedAt: new Date(), note: b.reason || null } });
    await this.db.notification.create({ data: { userId: a.userId, sender: 'Admin', title: 'Teacher application update', message: 'Your application was not approved.' + (b.reason ? ' Reason: ' + b.reason : '') } });
    this.mail.trigger('teacher_rejected', a.email, { name: a.name, reason: b.reason ? 'Reason: ' + b.reason : '' });
    return { ok: true };
  }
  @Patch('users/:id/role')
  async setRole(@Param('id') id: string, @Body() b: any) {
    const u = await this.db.user.findUnique({ where: { id } });
    if (!u) throw new NotFoundException();
    if (u.role === 'SUPER_ADMIN') throw new ForbiddenException('Cannot change super admin');
    const role = b.role === 'TEACHER' ? 'TEACHER' : 'USER';
    await this.db.user.update({ where: { id }, data: { role } });
    await this.db.notification.create({ data: { userId: id, sender: 'Admin', title: role === 'TEACHER' ? 'Teacher access granted' : 'Teacher access removed', message: role === 'TEACHER' ? 'You can now open the Teacher portal.' : 'Your teacher access was removed.' } });
    return { ok: true };
  }
}
