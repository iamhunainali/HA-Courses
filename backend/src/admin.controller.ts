import {
  BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Query, Res,
  UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'crypto';
import { unlink } from 'fs/promises';
import { diskStorage } from 'multer';
import { basename, extname, join } from 'path';
import { DEFAULT_CHECKOUT } from './checkout.defaults';
import { MailService } from './mail.service';
import { PrismaService } from './prisma.service';
import { AdminGuard, AuthGuard } from './guards';

const UP = process.env.UPLOAD_DIR || '/data/uploads';
export const store = (sub: string) => ({
  storage: diskStorage({
    destination: (_r, _f, cb) => cb(null, join(UP, sub)),
    filename: (_r, f, cb) => cb(null, randomUUID() + extname(f.originalname)),
  }),
  limits: { fileSize: 5 * 1024 * 1024 * 1024 },
});
export const rm = (sub: string, name?: string | null) => (name ? unlink(join(UP, sub, name)).catch(() => {}) : Promise.resolve());
export const labData = (b: any) => ({
  title: String(b.title || '').trim() || 'Untitled lab', description: b.description || '', kind: b.kind || 'Quiz',
  timeLimitMin: parseInt(b.timeLimitMin) || 0, passPercent: Math.min(100, Math.max(0, parseInt(b.passPercent) || 60)),
  published: b.published !== false, items: Array.isArray(b.items) ? b.items : [],
});

@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  constructor(private db: PrismaService, private mail: MailService) {}

  private async mailUser(userId: string, event: string, vars: Record<string, string>) {
    const u = await this.db.user.findUnique({ where: { id: userId } });
    if (u) this.mail.trigger(event, u.email, { name: u.name, ...vars });
  }

  @Get('stats')
  async stats() {
    const [users, courses, enrollments, reviews] = await Promise.all([
      this.db.user.count({ where: { role: 'USER' } }), this.db.course.count(), this.db.enrollment.count(), this.db.review.count(),
    ]);
    const pending = await this.db.paymentRequest.count({ where: { status: 'PENDING' } });
    const supportUnread = await this.db.supportMessage.count({ where: { from: 'USER', readByAdmin: false } });
    const apps = await this.db.teacherApplication.count({ where: { status: 'PENDING' } });
    const online = await this.db.user.count({ where: { lastSeen: { gt: new Date(Date.now() - 120000) } } });
    return { users, courses, enrollments, reviews, 'pending payments': pending, 'online now': online, 'support unread': supportUnread, 'teacher applications': apps };
  }

  // ----- Categories -----
  @Post('categories')
  addCategory(@Body() b: any) {
    if (!String(b.name || '').trim()) throw new BadRequestException('Name required');
    return this.db.category.create({ data: { name: b.name.trim() } });
  }
  @Delete('categories/:id') async delCategory(@Param('id') id: string) { await this.db.category.delete({ where: { id } }); return { ok: true }; }

  // ----- Courses -----
  @Get('courses') courses() { return this.db.course.findMany({ orderBy: { createdAt: 'desc' }, include: { category: true, _count: { select: { lessons: true, enrollments: true } } } }); }

  @Post('courses') @UseInterceptors(FileInterceptor('thumbnail', store('public')))
  createCourse(@Body() b: any, @UploadedFile() f: any) {
    if (!b.title || !b.description) throw new BadRequestException('Title and description required');
    return this.db.course.create({
      data: { title: b.title, description: b.description, price: parseFloat(b.price) || 0, published: b.published !== 'false', categoryId: b.categoryId || null, teacherId: b.teacherId || null, thumbnail: f?.filename, plan: b.plan === 'PREMIUM' ? 'PREMIUM' : 'FREE', durationDays: parseInt(b.durationDays) || 0 },
    });
  }

  @Patch('courses/:id') @UseInterceptors(FileInterceptor('thumbnail', store('public')))
  async updateCourse(@Param('id') id: string, @Body() b: any, @UploadedFile() f: any) {
    const c = await this.db.course.findUnique({ where: { id } });
    if (!c) throw new NotFoundException();
    if (f) await rm('public', c.thumbnail);
    return this.db.course.update({
      where: { id },
      data: {
        title: b.title ?? c.title, description: b.description ?? c.description,
        price: b.price !== undefined ? parseFloat(b.price) || 0 : c.price,
        published: b.published !== undefined ? b.published !== 'false' : c.published,
        plan: b.plan ? (b.plan === 'PREMIUM' ? 'PREMIUM' : 'FREE') : c.plan,
        teacherId: b.teacherId !== undefined ? b.teacherId || null : c.teacherId,
        durationDays: b.durationDays !== undefined ? parseInt(b.durationDays) || 0 : c.durationDays,
        categoryId: b.categoryId !== undefined ? b.categoryId || null : c.categoryId,
        ...(f ? { thumbnail: f.filename } : {}),
      },
    });
  }

  @Delete('courses/:id')
  async delCourse(@Param('id') id: string) {
    const c = await this.db.course.findUnique({ where: { id }, include: { lessons: { include: { files: true } } } });
    if (!c) throw new NotFoundException();
    await this.db.course.delete({ where: { id } });
    await rm('public', c.thumbnail);
    for (const l of c.lessons) { await rm('private', l.video); for (const x of l.files) await rm('private', x.path); }
    return { ok: true };
  }

  // ----- Lessons (video) + files -----
  @Get('courses/:id/lessons')
  lessons(@Param('id') id: string) { return this.db.lesson.findMany({ where: { courseId: id }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }], include: { files: true } }); }

  @Post('courses/:id/lessons') @UseInterceptors(FileInterceptor('video', store('private')))
  async addLesson(@Param('id') id: string, @Body() b: any, @UploadedFile() f: any) {
    if (!f) throw new BadRequestException('Video file required');
    const count = await this.db.lesson.count({ where: { courseId: id } });
    return this.db.lesson.create({ data: { courseId: id, title: b.title || f.originalname, video: f.filename, order: parseInt(b.order) || count + 1, section: b.section || null, description: b.description || null } });
  }

  @Post('courses/:id/lessons-link')
  async addLessonLink(@Param('id') id: string, @Body() b: any) {
    const url = String(b.url || '').trim();
    if (!/^https?:\/\//i.test(url)) throw new BadRequestException('Paste a valid link starting with http:// or https://');
    const count = await this.db.lesson.count({ where: { courseId: id } });
    return this.db.lesson.create({ data: { courseId: id, title: b.title || 'Lecture', video: '', videoUrl: url, order: count + 1, section: b.section || null, description: b.description || null } });
  }

  @Delete('lessons/:id')
  async delLesson(@Param('id') id: string) {
    const l = await this.db.lesson.findUnique({ where: { id }, include: { files: true } });
    if (!l) throw new NotFoundException();
    await this.db.lesson.delete({ where: { id } });
    await rm('private', l.video);
    for (const x of l.files) await rm('private', x.path);
    return { ok: true };
  }

  @Post('lessons/:id/files') @UseInterceptors(FileInterceptor('file', { ...store('private'), fileFilter: (_r, f, cb) => cb(null, /\.pdf$/i.test(f.originalname) && f.mimetype === 'application/pdf') }))
  addFile(@Param('id') id: string, @UploadedFile() f: any) {
    if (!f) throw new BadRequestException('Only PDF files are allowed in resources');
    return this.db.lessonFile.create({ data: { lessonId: id, name: f.originalname, path: f.filename } });
  }

  @Delete('files/:id')
  async delFile(@Param('id') id: string) {
    const f = await this.db.lessonFile.findUnique({ where: { id } });
    if (f) { await this.db.lessonFile.delete({ where: { id } }); await rm('private', f.path); }
    return { ok: true };
  }

  // ----- Slides -----
  @Get('slides') slides() { return this.db.slide.findMany({ orderBy: { order: 'asc' } }); }

  @Post('slides') @UseInterceptors(FileInterceptor('image', store('public')))
  async addSlide(@Body() b: any, @UploadedFile() f: any) {
    if (!f) throw new BadRequestException('Image required');
    const count = await this.db.slide.count();
    return this.db.slide.create({ data: { image: f.filename, caption: b.caption || null, order: count + 1 } });
  }

  @Delete('slides/:id')
  async delSlide(@Param('id') id: string) {
    const s = await this.db.slide.findUnique({ where: { id } });
    if (s) { await this.db.slide.delete({ where: { id } }); await rm('public', s.image); }
    return { ok: true };
  }

  // ----- Reviews (full control) -----
  @Get('reviews') reviews() { return this.db.review.findMany({ orderBy: { createdAt: 'desc' }, include: { user: { select: { name: true, email: true } } } }); }

  @Patch('reviews/:id')
  editReview(@Param('id') id: string, @Body() b: any) {
    return this.db.review.update({
      where: { id },
      data: { ...(b.comment !== undefined ? { comment: b.comment } : {}), ...(b.rating ? { rating: Math.min(5, Math.max(1, +b.rating)) } : {}), ...(b.status ? { status: b.status } : {}) },
    });
  }
  @Delete('reviews/:id') async delReview(@Param('id') id: string) { await this.db.review.delete({ where: { id } }); return { ok: true }; }

  // ----- Users -----
  @Get('users')
  async users(@Query('q') q?: string) {
    const rows = await this.db.user.findMany({
      where: q ? { OR: [{ email: { contains: q, mode: 'insensitive' } }, { name: { contains: q, mode: 'insensitive' } }] } : {},
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, role: true, status: true, warnings: true, createdAt: true, lastLogin: true, fatherName: true, phone: true, suspendedUntil: true, lastSeen: true, loginCount: true, failedLogins: true, _count: { select: { enrollments: true } } },
    });
    return rows.map((u) => ({ ...u, online: !!u.lastSeen && Date.now() - u.lastSeen.getTime() < 120000 }));
  }

  @Get('users/:id/activity')
  userActivity(@Param('id') id: string) { return this.db.activity.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 60 }); }

  @Get('activity')
  recentActivity() { return this.db.activity.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }); }

  @Patch('users/:id/action')
  async userAction(@Param('id') id: string, @Body() b: any) {
    const u = await this.db.user.findUnique({ where: { id } });
    if (!u) throw new NotFoundException();
    if (u.role === 'SUPER_ADMIN') throw new ForbiddenException('Cannot act on super admin');
    const mins = b.minutes === undefined || b.minutes === '' ? 60 : parseInt(b.minutes) || 0;
    const note = (title: string, message: string) => this.db.notification.create({ data: { userId: id, title, message, sender: b.sender || null } });
    switch (b.action) {
      case 'warn':
        await this.db.user.update({ where: { id }, data: { status: u.status === 'SUSPENDED' ? 'SUSPENDED' : 'WARNED', warnings: { increment: 1 } } });
        await note('Warning from admin', b.reason || 'Please follow the portal rules.');
        break;
      case 'suspend':
        await this.db.user.update({ where: { id }, data: { status: 'SUSPENDED', suspendedUntil: mins > 0 ? new Date(Date.now() + mins * 60000) : null, suspendReason: b.reason || null } });
        await note('Account suspended', (b.reason || 'Your account has been suspended.') + (mins > 0 ? ` You can log in again after ${mins} minute(s).` : ''));
        this.mailUser(id, 'suspended', { reason: b.reason || '', until: mins > 0 ? `after ${mins} minute(s)` : 'once an admin reactivates your account' });
        break;
      case 'activate':
        await this.db.user.update({ where: { id }, data: { status: 'ACTIVE', suspendedUntil: null, suspendReason: null, failedStreak: 0 } });
        await note('Account activated', 'Your account is active.');
        break;
      case 'clear_warnings':
        await this.db.user.update({ where: { id }, data: { status: 'ACTIVE', warnings: 0 } });
        break;
      case 'reset_password': {
        const temp = randomBytes(5).toString('hex');
        await this.db.user.update({ where: { id }, data: { password: await bcrypt.hash(temp, 10) } });
        await note('Password reset', 'Your password was reset by admin. Contact admin for the new password.');
        return { ok: true, tempPassword: temp };
      }
      case 'delete':
        await this.db.user.delete({ where: { id } });
        break;
      default:
        throw new BadRequestException('Unknown action');
    }
    return { ok: true };
  }

  // ----- Site settings -----
  @Patch('settings')
  async saveSettings(@Body() b: any) {
    const keys = ['siteName', 'tagline', 'footerText', 'coursesTitle', 'reviewsTitle', 'contactEmail', 'brandColor', 'headerMenu', 'headerShowCategories', 'currency', 'showTeacherApply'];
    for (const k of keys) {
      if (typeof b[k] === 'string') await this.db.setting.upsert({ where: { key: k }, update: { value: b[k] }, create: { key: k, value: b[k] } });
    }
    return { ok: true };
  }

  // ----- Edit endpoints -----
  @Patch('categories/:id')
  editCategory(@Param('id') id: string, @Body() b: any) {
    const data: any = {};
    if (b.name !== undefined) {
      const name = String(b.name).trim();
      if (!name) throw new BadRequestException('Name required');
      data.name = name;
    }
    if (typeof b.showInHeader === 'boolean') data.showInHeader = b.showInHeader;
    if (typeof b.showInCourses === 'boolean') data.showInCourses = b.showInCourses;
    if (b.order !== undefined) data.order = parseInt(b.order) || 0;
    return this.db.category.update({ where: { id }, data });
  }

  @Patch('lessons/:id')
  editLesson(@Param('id') id: string, @Body() b: any) {
    return this.db.lesson.update({ where: { id }, data: { ...(b.title ? { title: b.title } : {}), ...(b.order !== undefined && b.order !== '' ? { order: parseInt(b.order) || 0 } : {}), ...(b.section !== undefined ? { section: b.section || null } : {}), ...(b.description !== undefined ? { description: b.description || null } : {}) } });
  }

  @Patch('slides/:id')
  editSlide(@Param('id') id: string, @Body() b: any) {
    return this.db.slide.update({ where: { id }, data: { ...(b.caption !== undefined ? { caption: b.caption || null } : {}), ...(b.order !== undefined ? { order: parseInt(b.order) || 0 } : {}) } });
  }

  @Patch('users/:id')
  async editUser(@Param('id') id: string, @Body() b: any) {
    const u = await this.db.user.findUnique({ where: { id } });
    if (!u) throw new NotFoundException();
    if (u.role === 'SUPER_ADMIN') throw new ForbiddenException('Cannot edit super admin');
    const email = b.email ? String(b.email).trim().toLowerCase() : u.email;
    try {
      return await this.db.user.update({ where: { id }, data: { name: b.name?.trim() || u.name, email }, select: { id: true } });
    } catch { throw new ConflictException('Email already used'); }
  }

  // ----- Enrollments (admin kisi ko bhi enroll / remove kar sakta hai) -----
  @Get('courses/:id/enrollments')
  courseEnrollments(@Param('id') id: string) {
    return this.db.enrollment.findMany({ where: { courseId: id }, orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, name: true, email: true } } } });
  }

  @Post('courses/:id/enrollments')
  async addEnrollment(@Param('id') id: string, @Body() b: any) {
    const u = await this.db.user.findUnique({ where: { email: String(b.email || '').trim().toLowerCase() } });
    if (!u) throw new NotFoundException('No user with this email');
    const c = await this.db.course.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Course not found');
    const where = { userId_courseId: { userId: u.id, courseId: id } };
    if (!(await this.db.enrollment.findUnique({ where }))) {
      await this.db.enrollment.create({ data: { userId: u.id, courseId: id, celebrated: false, expiresAt: parseInt(b.days) > 0 ? new Date(Date.now() + parseInt(b.days) * 86400000) : null } });
      await this.db.notification.create({ data: { userId: u.id, title: 'Course added', message: `You were enrolled in "${c.title}" by admin. Open your dashboard.` } });
    }
    return { ok: true };
  }

  @Delete('enrollments/:id')
  async delEnrollment(@Param('id') id: string) { await this.db.enrollment.delete({ where: { id } }).catch(() => {}); return { ok: true }; }

  // ----- Homepage builder -----
  @Get('sections') adminSections() { return this.db.section.findMany({ orderBy: { order: 'asc' } }); }

  @Post('sections')
  async addSection(@Body() b: any) {
    if (!b.type) throw new BadRequestException('Type required');
    const count = await this.db.section.count();
    return this.db.section.create({ data: { type: b.type, data: b.data || {}, visible: b.visible !== false, order: count + 1 } });
  }

  @Post('sections/bulk')
  async bulkSections(@Body() b: any) {
    const list = Array.isArray(b.sections) ? b.sections : [];
    const start = await this.db.section.count();
    await this.db.section.createMany({ data: list.map((s: any, i: number) => ({ type: s.type, data: s.data || {}, visible: s.visible !== false, order: start + i + 1 })) });
    return { ok: true };
  }

  @Post('sections/reorder')
  async reorderSections(@Body() b: any) {
    const ids: string[] = Array.isArray(b.ids) ? b.ids : [];
    await Promise.all(ids.map((id, i) => this.db.section.update({ where: { id }, data: { order: i + 1 } })));
    return { ok: true };
  }

  @Patch('sections/:id')
  editSection(@Param('id') id: string, @Body() b: any) {
    return this.db.section.update({ where: { id }, data: { ...(b.data !== undefined ? { data: b.data } : {}), ...(typeof b.visible === 'boolean' ? { visible: b.visible } : {}) } });
  }

  @Delete('sections/:id') async delSection(@Param('id') id: string) { await this.db.section.delete({ where: { id } }).catch(() => {}); return { ok: true }; }

  // Builder ke liye image upload (filename wapis milta hai)
  @Post('upload') @UseInterceptors(FileInterceptor('file', store('public')))
  uploadImage(@UploadedFile() f: any) {
    if (!f) throw new BadRequestException('File required');
    return { file: f.filename };
  }

  // ----- Terminate / restore access (user ko dobara payment karni hogi) -----
  @Post('enrollments/:id/revoke')
  async revokeEnrollment(@Param('id') id: string, @Body() b: any) {
    const e = await this.db.enrollment.findUnique({ where: { id }, include: { course: true } });
    if (!e) throw new NotFoundException();
    await this.db.enrollment.update({ where: { id }, data: { revokedAt: new Date() } });
    await this.db.notification.create({ data: { userId: e.userId, sender: b.sender || 'Admin', title: 'Course access ended', message: `Your access to "${e.course.title}" was ended by admin.${b.reason ? ' Reason: ' + b.reason : ''} To enroll again, please complete the payment again.` } });
    this.mailUser(e.userId, 'access_ended', { course: e.course.title, reason: b.reason ? 'Reason: ' + b.reason : '' });
    return { ok: true };
  }

  @Post('enrollments/:id/restore')
  async restoreEnrollment(@Param('id') id: string) { await this.db.enrollment.update({ where: { id }, data: { revokedAt: null } }); return { ok: true }; }

  // ----- Labs -----
  @Get('courses/:id/labs')
  adminLabs(@Param('id') id: string) { return this.db.lab.findMany({ where: { courseId: id }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }], include: { _count: { select: { attempts: true } } } }); }

  @Post('courses/:id/labs')
  async addLab(@Param('id') id: string, @Body() b: any) {
    const count = await this.db.lab.count({ where: { courseId: id } });
    return this.db.lab.create({ data: { courseId: id, ...labData(b), order: count + 1 } });
  }

  @Patch('labs/:id') editLab(@Param('id') id: string, @Body() b: any) { return this.db.lab.update({ where: { id }, data: labData(b) }); }
  @Delete('labs/:id') async delLab(@Param('id') id: string) { await this.db.lab.delete({ where: { id } }).catch(() => {}); return { ok: true }; }

  @Get('labs/:id/attempts')
  labAttempts(@Param('id') id: string) {
    return this.db.labAttempt.findMany({ where: { labId: id }, orderBy: { createdAt: 'desc' }, take: 200, include: { user: { select: { name: true, email: true } } } });
  }

  // ----- Enrollment expiry -----
  @Patch('enrollments/:id')
  editEnrollment(@Param('id') id: string, @Body() b: any) {
    const days = parseInt(b.days);
    return this.db.enrollment.update({ where: { id }, data: { expiresAt: days > 0 ? new Date(Date.now() + days * 86400000) : null } });
  }

  // ----- Payment requests -----
  @Get('payments')
  payments(@Query('status') status?: string) {
    return this.db.paymentRequest.findMany({
      where: status ? { status } : {}, orderBy: { createdAt: 'desc' }, take: 200,
      include: { user: { select: { id: true, name: true, email: true } }, course: { select: { id: true, title: true } } },
    });
  }

  @Post('payments/:id/approve')
  async approvePayment(@Param('id') id: string, @Body() b: any) {
    const p = await this.db.paymentRequest.findUnique({ where: { id }, include: { course: true } });
    if (!p) throw new NotFoundException();
    if (p.status !== 'PENDING') throw new BadRequestException('Already reviewed');
    const days = b.days !== undefined && b.days !== '' ? parseInt(b.days) || 0 : p.days;
    const existing = await this.db.enrollment.findUnique({ where: { userId_courseId: { userId: p.userId, courseId: p.courseId } } });
    const base = existing?.expiresAt && existing.expiresAt > new Date() ? existing.expiresAt : new Date();
    const expiresAt = days > 0 ? new Date(base.getTime() + days * 86400000) : null;
    if (existing) await this.db.enrollment.update({ where: { id: existing.id }, data: { expiresAt, celebrated: false, revokedAt: null } });
    else await this.db.enrollment.create({ data: { userId: p.userId, courseId: p.courseId, expiresAt, celebrated: false } });
    await this.db.paymentRequest.update({ where: { id }, data: { status: 'APPROVED', reviewedAt: new Date(), note: b.note || null } });
    await this.db.notification.create({ data: { userId: p.userId, sender: 'Payments', title: 'Access granted', message: `Your payment was approved. You now have access to "${p.course.title}"${expiresAt ? ` until ${expiresAt.toDateString()}` : ''}.` } });
    this.mailUser(p.userId, 'payment_approved', { course: p.course.title });
    return { ok: true };
  }

  @Post('payments/:id/reject')
  async rejectPayment(@Param('id') id: string, @Body() b: any) {
    const p = await this.db.paymentRequest.findUnique({ where: { id }, include: { course: true } });
    if (!p) throw new NotFoundException();
    if (p.status !== 'PENDING') throw new BadRequestException('Already reviewed');
    await this.db.paymentRequest.update({ where: { id }, data: { status: 'REJECTED', reviewedAt: new Date(), note: b.reason || null } });
    await this.db.notification.create({ data: { userId: p.userId, sender: 'Payments', title: 'Payment not approved', message: `Your payment for "${p.course.title}" could not be verified.${b.reason ? ' Reason: ' + b.reason : ''} You can submit the form again.` } });
    this.mailUser(p.userId, 'payment_rejected', { course: p.course.title, reason: b.reason ? 'Reason: ' + b.reason : '' });
    return { ok: true };
  }

  @Get('payment-files/:name')
  paymentFile(@Param('name') name: string, @Res() res: any) { res.sendFile(join(UP, 'private', basename(name))); }

  // ----- Checkout page editor -----
  @Get('checkout')
  async getCheckout() {
    const row = await this.db.setting.findUnique({ where: { key: 'checkoutConfig' } });
    try { return { ...DEFAULT_CHECKOUT, ...(row ? JSON.parse(row.value) : {}) }; } catch { return DEFAULT_CHECKOUT; }
  }

  @Patch('checkout')
  async saveCheckout(@Body() b: any) {
    const value = JSON.stringify(b.config || {});
    await this.db.setting.upsert({ where: { key: 'checkoutConfig' }, update: { value }, create: { key: 'checkoutConfig', value } });
    return { ok: true };
  }

  // ----- Messages (notifications) -----
  @Post('message')
  async message(@Body() b: any) {
    if (!b.title || !b.message) throw new BadRequestException('Title and message required');
    if (b.email) {
      const u = await this.db.user.findUnique({ where: { email: String(b.email).trim().toLowerCase() } });
      if (!u) throw new NotFoundException('No user with this email');
      await this.db.notification.create({ data: { userId: u.id, title: b.title, message: b.message, sender: b.sender || null } });
      if (b.sendEmail) this.mail.send(u.email, b.title, String(b.message).replace(/\n/g, '<br>'), 'message');
      return { sent: 1 };
    }
    const all = await this.db.user.findMany({ where: { role: 'USER' }, select: { id: true, email: true } });
    await this.db.notification.createMany({ data: all.map((u) => ({ userId: u.id, title: b.title, message: b.message, sender: b.sender || null })) });
    if (b.sendEmail) (async () => { for (const u of all.slice(0, 400)) await this.mail.send(u.email, b.title, String(b.message).replace(/\n/g, '<br>'), 'message'); })().catch(() => {});
    return { sent: all.length };
  }
}
