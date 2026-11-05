import {
  BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, NotFoundException,
  OnModuleInit, Param, Patch, Post, Query, Req, Res, UnauthorizedException, UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { join } from 'path';
import { PrismaService } from './prisma.service';
import { AuthGuard } from './guards';

const UP = process.env.UPLOAD_DIR || '/data/uploads';
const safe = (u: any) => { const { password, ...r } = u; return r; };

@Controller()
export class AppController implements OnModuleInit {
  constructor(private db: PrismaService, private jwt: JwtService) {}

  // Super admin pehli dafa auto-create hota hai (password dobara overwrite nahi hota)
  async onModuleInit() {
    const email = (process.env.ADMIN_EMAIL || 'admin@portal.com').toLowerCase();
    const exists = await this.db.user.findUnique({ where: { email } });
    if (!exists) {
      await this.db.user.create({
        data: { name: 'Super Admin', email, role: 'SUPER_ADMIN', password: await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@12345', 10) },
      });
    }
  }

  private async access(user: any, courseId: string) {
    if (user.role === 'SUPER_ADMIN') return;
    const e = await this.db.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId } } });
    if (!e) throw new ForbiddenException('Enroll in this course first');
  }

  // ---------- Auth ----------
  @Post('auth/signup')
  async signup(@Body() b: any) {
    const email = String(b.email || '').trim().toLowerCase();
    if (!String(b.name || '').trim() || !email.includes('@') || String(b.password || '').length < 6)
      throw new BadRequestException('Name, valid email and password (min 6 chars) required');
    if (await this.db.user.findUnique({ where: { email } })) throw new ConflictException('Email already registered');
    const u = await this.db.user.create({ data: { name: b.name.trim(), email, password: await bcrypt.hash(b.password, 10), lastLogin: new Date() } });
    return { token: this.jwt.sign({ sub: u.id }), user: safe(u) };
  }

  @Post('auth/login')
  async login(@Body() b: any) {
    const u = await this.db.user.findUnique({ where: { email: String(b.email || '').trim().toLowerCase() } });
    if (!u || !(await bcrypt.compare(String(b.password || ''), u.password))) throw new UnauthorizedException('Wrong email or password');
    if (u.status === 'SUSPENDED') throw new ForbiddenException('Your account is suspended. Contact admin.');
    await this.db.user.update({ where: { id: u.id }, data: { lastLogin: new Date() } });
    return { token: this.jwt.sign({ sub: u.id }), user: safe(u) };
  }

  @UseGuards(AuthGuard) @Get('auth/me')
  me(@Req() req: any) { return safe(req.user); }

  // ---------- Public ----------
  @Get('categories') categories() { return this.db.category.findMany({ orderBy: [{ order: 'asc' }, { name: 'asc' }] }); }
  @Get('slides') slides() { return this.db.slide.findMany({ orderBy: { order: 'asc' } }); }

  // Site settings (name, tagline, footer, colors) - public
  @Get('settings')
  async settings() {
    const rows = await this.db.setting.findMany();
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
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
    const where = { userId_courseId: { userId: req.user.id, courseId: id } };
    if (!(await this.db.enrollment.findUnique({ where }))) {
      await this.db.enrollment.create({ data: { userId: req.user.id, courseId: id } });
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
    return e.map((x) => x.course);
  }

  @UseGuards(AuthGuard) @Get('my/courses/:id/lessons')
  async myLessons(@Param('id') id: string, @Req() req: any) {
    await this.access(req.user, id);
    return this.db.lesson.findMany({
      where: { courseId: id }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, title: true, order: true, files: { select: { id: true, name: true } } },
    });
  }

  // Protected video streaming (Range support sendFile se). Token query se bhi chalta hai.
  @UseGuards(AuthGuard) @Get('stream/:id')
  async stream(@Param('id') id: string, @Req() req: any, @Res() res: any) {
    const l = await this.db.lesson.findUnique({ where: { id } });
    if (!l) throw new NotFoundException();
    await this.access(req.user, l.courseId);
    res.sendFile(join(UP, 'private', l.video));
  }

  @UseGuards(AuthGuard) @Get('files/:id')
  async file(@Param('id') id: string, @Req() req: any, @Res() res: any) {
    const f = await this.db.lessonFile.findUnique({ where: { id }, include: { lesson: true } });
    if (!f) throw new NotFoundException();
    await this.access(req.user, f.lesson.courseId);
    res.download(join(UP, 'private', f.path), f.name);
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
