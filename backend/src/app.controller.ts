import {
  BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, NotFoundException,
  OnModuleInit, Param, Patch, Post, Query, Req, Res, UnauthorizedException, UploadedFiles, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { join } from 'path';
import { PrismaService } from './prisma.service';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { AuthGuard } from './guards';
import { DEFAULT_CHECKOUT } from './checkout.defaults';
import { MailService } from './mail.service';

const UP = process.env.UPLOAD_DIR || '/data/uploads';
const safe = (u: any) => { const { password, ...r } = u; return r; };

@Controller()
export class AppController implements OnModuleInit {
  constructor(private db: PrismaService, private jwt: JwtService, private mail: MailService) {}

  // Super admin pehli dafa auto-create hota hai (password dobara overwrite nahi hota)
  async onModuleInit() {
    const email = (process.env.ADMIN_EMAIL || 'admin@portal.com').toLowerCase();
    const exists = await this.db.user.findUnique({ where: { email } });
    if (!exists) {
      await this.db.user.create({
        data: { name: 'Super Admin', email, role: 'SUPER_ADMIN', password: await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@12345', 10) },
      });
    }
    this.startSuspensionJob();
  }

  // Har minute: jin users ki suspension ka time poora ho gaya unko ACTIVE karo + notification
  private startSuspensionJob() {
    const run = async () => {
      try {
        const due = await this.db.user.findMany({ where: { status: 'SUSPENDED', suspendedUntil: { lte: new Date() } }, select: { id: true } });
        for (const x of due) {
          await this.db.user.update({ where: { id: x.id }, data: { status: 'ACTIVE', suspendedUntil: null, suspendReason: null, failedStreak: 0 } });
          await this.db.notification.create({ data: { userId: x.id, sender: 'System', title: 'Account active again', message: 'Your suspension has ended. Your account is active again.' } });
        }
      } catch {}
    };
    setInterval(run, 60000).unref();
  }

  private suspendedBody(u: any) {
    return { statusCode: 403, message: 'Your account is suspended.', code: 'SUSPENDED', until: u.suspendedUntil, reason: u.suspendReason };
  }
  private async liftIfExpired(u: any) {
    if (u.status === 'SUSPENDED' && u.suspendedUntil && u.suspendedUntil <= new Date())
      return this.db.user.update({ where: { id: u.id }, data: { status: 'ACTIVE', suspendedUntil: null, suspendReason: null, failedStreak: 0 } });
    return u;
  }

  private ip(req: any) { return String(req.headers['x-real-ip'] || req.ip || ''); }
  private async log(type: string, email: string, userId: string | null, req: any) {
    await this.db.activity.create({ data: { type, email, userId, ip: this.ip(req), agent: String(req.headers['user-agent'] || '').slice(0, 200) } }).catch(() => {});
  }

  private async loadCheckout() {
    const row = await this.db.setting.findUnique({ where: { key: 'checkoutConfig' } });
    try { return { ...DEFAULT_CHECKOUT, ...(row ? JSON.parse(row.value) : {}) }; } catch { return DEFAULT_CHECKOUT; }
  }

  private async access(user: any, courseId: string) {
    if (user.role === 'SUPER_ADMIN') return;
    const e = await this.db.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId } } });
    if (!e) throw new ForbiddenException('Enroll in this course first');
    if (e.revokedAt) throw new ForbiddenException('Your access was ended by admin. Please pay again to re-enroll.');
    if (e.expiresAt && e.expiresAt < new Date()) throw new ForbiddenException('Your access has expired. Please renew.');
  }

  // ---------- Auth ----------
  @Post('auth/signup')
  async signup(@Body() b: any) {
    const email = String(b.email || '').trim().toLowerCase();
    if (!String(b.name || '').trim() || !email.includes('@') || String(b.password || '').length < 6)
      throw new BadRequestException('Name, valid email and password (min 6 chars) required');
    if (await this.db.user.findUnique({ where: { email } })) throw new ConflictException('Email already registered');
    const u = await this.db.user.create({ data: { name: b.name.trim(), email, password: await bcrypt.hash(b.password, 10), lastLogin: new Date(), lastSeen: new Date(), loginCount: 1 } });
    this.mail.trigger('welcome', u.email, { name: u.name });
    return { token: this.jwt.sign({ sub: u.id }), user: safe(u) };
  }

  @Post('auth/login')
  async login(@Body() b: any, @Req() req: any) {
    const MAX_FAILED = 4;
    const email = String(b.email || '').trim().toLowerCase();
    let u: any = await this.db.user.findUnique({ where: { email } });
    if (u) u = await this.liftIfExpired(u);

    // Email detect: suspended account ki har login attempt par warning popup ka data
    if (u && u.status === 'SUSPENDED') {
      await this.log('BLOCKED_LOGIN', email, u.id, req);
      throw new ForbiddenException(this.suspendedBody(u));
    }

    if (!u || !(await bcrypt.compare(String(b.password || ''), u.password))) {
      await this.log('FAILED_LOGIN', email, u ? u.id : null, req);
      if (!u) throw new UnauthorizedException('Wrong email or password');
      const streak = u.failedStreak + 1;
      await this.db.user.update({ where: { id: u.id }, data: { failedLogins: { increment: 1 }, failedStreak: streak } });
      if (u.role !== 'SUPER_ADMIN') {
        if (streak >= MAX_FAILED) {
          const s = await this.db.user.update({ where: { id: u.id }, data: { status: 'SUSPENDED', suspendedUntil: new Date(Date.now() + 3600 * 1000), suspendReason: 'Too many failed login attempts', failedStreak: 0 } });
          await this.log('AUTO_SUSPEND', email, u.id, req);
          this.mail.trigger('suspended', u.email, { name: u.name, reason: 'Too many failed login attempts.', until: 'after 1 hour' });
          await this.db.notification.create({ data: { userId: u.id, sender: 'Security', title: 'Account suspended', message: 'Your account was suspended for 1 hour after 4 failed login attempts.' } });
          throw new ForbiddenException(this.suspendedBody(s));
        }
        throw new UnauthorizedException(`Wrong email or password. ${MAX_FAILED - streak} attempt(s) left before your account is suspended for 1 hour.`);
      }
      throw new UnauthorizedException('Wrong email or password');
    }

    await this.db.user.update({ where: { id: u.id }, data: { lastLogin: new Date(), lastSeen: new Date(), loginCount: { increment: 1 }, failedStreak: 0 } });
    await this.log('LOGIN', email, u.id, req);
    return { token: this.jwt.sign({ sub: u.id }), user: safe(u) };
  }

  @UseGuards(AuthGuard) @Get('auth/me')
  me(@Req() req: any) { return safe(req.user); }

  // Online/offline tracking
  @UseGuards(AuthGuard) @Post('auth/ping')
  async ping(@Req() req: any) { await this.db.user.update({ where: { id: req.user.id }, data: { lastSeen: new Date() } }); return { ok: true }; }

  @UseGuards(AuthGuard) @Post('auth/logout')
  async logout(@Req() req: any) { await this.db.user.update({ where: { id: req.user.id }, data: { lastSeen: null } }); return { ok: true }; }

  // ---------- Public ----------
  @Get('categories') categories() { return this.db.category.findMany({ orderBy: [{ order: 'asc' }, { name: 'asc' }] }); }
  @Get('slides') slides() { return this.db.slide.findMany({ orderBy: { order: 'asc' } }); }

  // Site settings (name, tagline, footer, colors) - public
  @Get('settings')
  async settings() {
    const rows = await this.db.setting.findMany();
    return Object.fromEntries(rows.filter((r) => r.key !== 'checkoutConfig').map((r) => [r.key, r.value]));
  }

  // Homepage sections (admin builder se). configured=false -> frontend default layout dikhata hai
  @Get('sections')
  async sections() {
    const all = await this.db.section.findMany({ orderBy: { order: 'asc' } });
    return { configured: all.length > 0, sections: all.filter((s) => s.visible) };
  }

  @Get('reviews')
  reviews() {
    return this.db.review.findMany({ where: { status: 'VISIBLE' }, orderBy: { createdAt: 'desc' }, take: 50, include: { user: { select: { name: true } } } });
  }

  // Course list + details public (videos nahi, wo sirf enrolled users ko)
  @Get('courses/:id')
  async courseDetail(@Param('id') id: string) {
    const c = await this.db.course.findFirst({ where: { id, published: true }, include: { category: true, _count: { select: { lessons: true, enrollments: true } } } });
    if (!c) throw new NotFoundException('Course not found');
    return c;
  }

  // ---------- Logged-in ----------
  @Get('courses')
  courses(@Query() q: any) {
    return this.db.course.findMany({
      where: {
        published: true,
        ...(q.category ? { categoryId: q.category } : {}),
        ...(q.q ? { title: { contains: q.q, mode: 'insensitive' } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { category: true, _count: { select: { lessons: true } } },
    });
  }

  @UseGuards(AuthGuard) @Post('courses/:id/enroll')
  async enroll(@Param('id') id: string, @Req() req: any) {
    const c = await this.db.course.findFirst({ where: { id, published: true } });
    if (!c) throw new NotFoundException('Course not found');
    if (c.plan === 'PREMIUM' && req.user.role !== 'SUPER_ADMIN') throw new BadRequestException('This is a premium course. Please complete checkout.');
    const where = { userId_courseId: { userId: req.user.id, courseId: id } };
    const prev = await this.db.enrollment.findUnique({ where });
    if (prev?.revokedAt) throw new BadRequestException('Your access was ended by admin. Please complete the payment again to re-enroll.');
    if (!prev) {
      await this.db.enrollment.create({ data: { userId: req.user.id, courseId: id, celebrated: false } });
      await this.db.notification.create({ data: { userId: req.user.id, title: 'Enrolled', message: `You are enrolled in "${c.title}". Open your dashboard to start.` } });
    }
    return { ok: true };
  }

  @UseGuards(AuthGuard) @Get('my/enrollments')
  async myEnrollments(@Req() req: any) {
    const e = await this.db.enrollment.findMany({
      where: { userId: req.user.id }, orderBy: { createdAt: 'desc' },
      include: { course: { include: { category: true, _count: { select: { lessons: true } } } } },
    });
    const prog = await this.db.lessonProgress.findMany({ where: { userId: req.user.id }, select: { lesson: { select: { courseId: true } } } });
    const done: Record<string, number> = {};
    prog.forEach((p) => { done[p.lesson.courseId] = (done[p.lesson.courseId] || 0) + 1; });
    const now = new Date();
    return e.map((x) => ({
      ...x.course,
      enrollment: { id: x.id, createdAt: x.createdAt, expiresAt: x.expiresAt, expired: !!x.expiresAt && x.expiresAt < now, revoked: !!x.revokedAt, completed: done[x.courseId] || 0 },
    }));
  }

  @UseGuards(AuthGuard) @Get('my/courses/:id/lessons')
  async myLessons(@Param('id') id: string, @Req() req: any) {
    await this.access(req.user, id);
    const [lessons, done] = await Promise.all([
      this.db.lesson.findMany({
        where: { courseId: id }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, title: true, order: true, section: true, description: true, videoUrl: true, files: { select: { id: true, name: true } } },
      }),
      this.db.lessonProgress.findMany({ where: { userId: req.user.id, lesson: { courseId: id } }, select: { lessonId: true } }),
    ]);
    const set = new Set(done.map((d) => d.lessonId));
    return lessons.map((l) => ({ ...l, completed: set.has(l.id) }));
  }

  @UseGuards(AuthGuard) @Post('lessons/:id/complete')
  async complete(@Param('id') id: string, @Body() b: any, @Req() req: any) {
    const l = await this.db.lesson.findUnique({ where: { id } });
    if (!l) throw new NotFoundException();
    await this.access(req.user, l.courseId);
    if (b.done === false) await this.db.lessonProgress.deleteMany({ where: { userId: req.user.id, lessonId: id } });
    else await this.db.lessonProgress.upsert({ where: { userId_lessonId: { userId: req.user.id, lessonId: id } }, update: {}, create: { userId: req.user.id, lessonId: id } });
    return { ok: true };
  }

  // Protected video streaming (Range support sendFile se). Token query se bhi chalta hai.
  @UseGuards(AuthGuard) @Get('stream/:id')
  async stream(@Param('id') id: string, @Req() req: any, @Res() res: any) {
    // Address bar se direct open / "save as" block: browser ka video player 'video' destination bhejta hai
    const dest = String(req.headers['sec-fetch-dest'] || '');
    if (dest && dest !== 'video') throw new ForbiddenException('Streaming only');
    const l = await this.db.lesson.findUnique({ where: { id } });
    if (!l || !l.video) throw new NotFoundException();
    await this.access(req.user, l.courseId);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(join(UP, 'private', l.video));
  }

  // Resources: sirf PDF. ?dl=1 par download, warna inline view
  @UseGuards(AuthGuard) @Get('files/:id')
  async file(@Param('id') id: string, @Req() req: any, @Res() res: any) {
    const f = await this.db.lessonFile.findUnique({ where: { id }, include: { lesson: true } });
    if (!f) throw new NotFoundException();
    await this.access(req.user, f.lesson.courseId);
    if (!/\.pdf$/i.test(f.name)) throw new ForbiddenException('Only PDF resources are available');
    const p = join(UP, 'private', f.path);
    if (req.query.dl === '1') return res.download(p, f.name);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.sendFile(p);
  }

  // ---------- Checkout (premium courses) ----------
  @UseGuards(AuthGuard) @Get('checkout/config')
  checkoutConfig() { return this.loadCheckout(); }

  @UseGuards(AuthGuard) @Get('my/payments')
  myPayments(@Req() req: any) {
    return this.db.paymentRequest.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, include: { course: { select: { id: true, title: true } } } });
  }

  // Form submit -> PENDING request. Access admin approve karne par hi milta hai.
  @UseGuards(AuthGuard) @Post('courses/:id/checkout')
  @UseInterceptors(AnyFilesInterceptor({
    storage: diskStorage({ destination: (_r, _f, cb) => cb(null, join(UP, 'private')), filename: (_r, f, cb) => cb(null, randomUUID() + extname(f.originalname)) }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_r, f, cb) => cb(null, /^(image\/|application\/pdf)/.test(f.mimetype)),
  }))
  async checkout(@Param('id') id: string, @Body() b: any, @UploadedFiles() files: any[], @Req() req: any) {
    const c = await this.db.course.findFirst({ where: { id, published: true } });
    const enr = await this.db.enrollment.findUnique({ where: { userId_courseId: { userId: req.user.id, courseId: id } } });
    if (!c || (c.plan !== 'PREMIUM' && !enr?.revokedAt)) throw new BadRequestException('This course does not need payment');
    if (enr && !enr.revokedAt && (!enr.expiresAt || enr.expiresAt > new Date())) throw new ConflictException('You already have access to this course');
    if (await this.db.paymentRequest.findFirst({ where: { userId: req.user.id, courseId: id, status: 'PENDING' } })) throw new ConflictException('You already have a pending request for this course');

    const cfg = await this.loadCheckout();
    let given: any = {};
    try { given = JSON.parse(b.answers || '{}'); } catch {}
    const byKey = new Map((files || []).map((f: any) => [f.fieldname, f]));
    const answers: any[] = [];
    for (const f of cfg.fields || []) {
      const value = f.type === 'file' ? (byKey.get(f.key) as any)?.filename || '' : String(given[f.key] ?? '').trim();
      if (f.required && !value) throw new BadRequestException(`${f.label} is required`);
      answers.push({ key: f.key, label: f.label, type: f.type, value });
    }
    if (cfg.terms && given.__terms !== true && given.__terms !== 'true') throw new BadRequestException('Please tick the confirmation box');
    const fatherName = String(b.fatherName || '').trim();
    const phone = String(b.phone || '').trim();
    if (fatherName.length < 2) throw new BadRequestException('Father name is required');
    if (!/^\+?[0-9][0-9\s-]{8,18}$/.test(phone)) throw new BadRequestException('Enter a valid phone number');
    await this.db.user.update({ where: { id: req.user.id }, data: { fatherName, phone } });
    const hours = Number(cfg.reviewHours) || 3;
    const r = await this.db.paymentRequest.create({ data: { userId: req.user.id, courseId: id, answers, fatherName, phone, amount: c.price, days: c.durationDays, dueAt: new Date(Date.now() + hours * 3600 * 1000) } });
    await this.db.notification.create({ data: { userId: req.user.id, sender: 'Payments', title: 'Payment request received', message: `We received your request for "${c.title}". Review time: up to ${hours} hours. You will be notified when access is granted.` } });
    this.mail.trigger('payment_received', req.user.email, { name: req.user.name, course: c.title, hours: String(hours) });
    return r;
  }

  // ---------- Congratulation popup ----------
  @UseGuards(AuthGuard) @Get('my/celebrations')
  celebrations(@Req() req: any) {
    return this.db.enrollment.findMany({
      where: { userId: req.user.id, celebrated: false, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      include: { course: { select: { id: true, title: true, thumbnail: true } } }, orderBy: { createdAt: 'asc' },
    });
  }

  @UseGuards(AuthGuard) @Post('my/celebrations/:id/seen')
  async seen(@Param('id') id: string, @Req() req: any) {
    await this.db.enrollment.updateMany({ where: { id, userId: req.user.id }, data: { celebrated: true } });
    return { ok: true };
  }

  // ---------- Labs (MCQs / practice) ----------
  private lines(s: any) { return String(s || '').split('\n').map((x) => x.trim()).filter(Boolean); }
  private opts(q: any): string[] { return Array.isArray(q.options) ? q.options.map((x: any) => String(x)) : this.lines(q.options); }
  private idx(q: any): number[] { return Array.isArray(q.correct) ? q.correct.map(Number).filter((n: number) => n >= 0) : this.nums(q.correct); }
  private nums(s: any) { return String(s || '').split(/[\s,]+/).map((n) => parseInt(n) - 1).filter((n) => n >= 0); }

  @UseGuards(AuthGuard) @Get('my/courses/:id/labs')
  async myLabs(@Param('id') id: string, @Req() req: any) {
    await this.access(req.user, id);
    const labs = await this.db.lab.findMany({ where: { courseId: id, published: true }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] });
    const attempts = await this.db.labAttempt.findMany({ where: { userId: req.user.id, labId: { in: labs.map((l) => l.id) } } });
    return labs.map((l) => {
      const mine = attempts.filter((a) => a.labId === l.id);
      return {
        id: l.id, title: l.title, description: l.description, kind: l.kind, timeLimitMin: l.timeLimitMin, passPercent: l.passPercent,
        questions: (l.items as any[]).length, attempts: mine.length, best: mine.length ? Math.max(...mine.map((a) => a.percent)) : null, passed: mine.some((a) => a.passed),
      };
    });
  }

  // Correct answers yahan nahi bheje jatay
  @UseGuards(AuthGuard) @Get('labs/:id')
  async lab(@Param('id') id: string, @Req() req: any) {
    const l = await this.db.lab.findUnique({ where: { id } });
    if (!l || !l.published) throw new NotFoundException();
    await this.access(req.user, l.courseId);
    return {
      id: l.id, title: l.title, description: l.description, kind: l.kind, timeLimitMin: l.timeLimitMin, passPercent: l.passPercent,
      items: (l.items as any[]).map((q) => ({ type: q.type || 'mcq', text: q.text || '', options: this.opts(q), hint: q.hint || '' })),
    };
  }

  @UseGuards(AuthGuard) @Post('labs/:id/submit')
  async submitLab(@Param('id') id: string, @Body() b: any, @Req() req: any) {
    const l = await this.db.lab.findUnique({ where: { id } });
    if (!l || !l.published) throw new NotFoundException();
    await this.access(req.user, l.courseId);
    const answers = b.answers || {};
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
    let total = 0, score = 0;
    const results = (l.items as any[]).map((q, i) => {
      const t = q.type || 'mcq', a = answers[i], opts = this.opts(q);
      if (t === 'task') return { type: t, done: !!a, solution: q.solution || '', explanation: q.explanation || '' };
      total++;
      let ok = false, correct = '';
      if (t === 'mcq') { const c = this.idx(q)[0]; ok = a !== undefined && a !== '' && Number(a) === c; correct = opts[c] || ''; }
      else if (t === 'multi') {
        const c = this.idx(q).sort(), g = (Array.isArray(a) ? a : []).map(Number).sort();
        ok = c.length > 0 && c.length === g.length && c.every((x, k) => x === g[k]); correct = c.map((n) => opts[n]).join(', ');
      } else { const acc = this.lines(q.answers).map(norm); ok = acc.includes(norm(String(a || ''))); correct = this.lines(q.answers)[0] || ''; }
      if (ok) score++;
      return { type: t, ok, correct, explanation: q.explanation || '' };
    });
    const percent = total ? Math.round((score / total) * 100) : 100;
    const passed = percent >= l.passPercent;
    await this.db.labAttempt.create({ data: { labId: id, userId: req.user.id, score, total, percent, passed } });
    return { score, total, percent, passed, results };
  }

  // ---------- Reviews ----------
  @UseGuards(AuthGuard) @Post('reviews')
  postReview(@Body() b: any, @Req() req: any) {
    const rating = Math.min(5, Math.max(1, parseInt(b.rating) || 5));
    if (!String(b.comment || '').trim()) throw new BadRequestException('Write a review first');
    return this.db.review.create({ data: { userId: req.user.id, rating, comment: b.comment.trim() } });
  }

  @UseGuards(AuthGuard) @Get('my/reviews')
  myReviews(@Req() req: any) { return this.db.review.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' } }); }

  @UseGuards(AuthGuard) @Patch('reviews/:id')
  async editReview(@Param('id') id: string, @Body() b: any, @Req() req: any) {
    const r = await this.db.review.findUnique({ where: { id } });
    if (!r || r.userId !== req.user.id) throw new ForbiddenException();
    return this.db.review.update({ where: { id }, data: { comment: b.comment?.trim() || r.comment, rating: Math.min(5, Math.max(1, parseInt(b.rating) || r.rating)) } });
  }

  @UseGuards(AuthGuard) @Delete('reviews/:id')
  async delReview(@Param('id') id: string, @Req() req: any) {
    const r = await this.db.review.findUnique({ where: { id } });
    if (!r || r.userId !== req.user.id) throw new ForbiddenException();
    await this.db.review.delete({ where: { id } });
    return { ok: true };
  }

  // ---------- Notifications ----------
  @UseGuards(AuthGuard) @Get('notifications')
  notifications(@Req() req: any) { return this.db.notification.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 30 }); }

  @UseGuards(AuthGuard) @Post('notifications/read')
  async readAll(@Req() req: any) { await this.db.notification.updateMany({ where: { userId: req.user.id, read: false }, data: { read: true } }); return { ok: true }; }
}
